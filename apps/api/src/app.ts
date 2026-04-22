import { zValidator } from "@hono/zod-validator";
import { openApiDocument } from "@kordu-probe/shared";
import { Hono } from "hono";
import { z } from "zod";

import { buildHttpCommands, buildProbeCommands } from "./lib/commands";
import { emptyRecords } from "./lib/dns";
import { OperationTimeoutError, ProbeConfigurationError, InvalidTargetError } from "./lib/errors";
import { clampTimeout, getRateLimitBinding, getRateLimitCost, getRateLimitTier, getRequestedModules, getRequestedModulesForTargetKind } from "./lib/modules";
import { normalizeTargetInput } from "./lib/targets";
import type {
  AppBindings,
  CheckModule,
  CheckRequest,
  CheckResponse,
  DnsCheckResult,
  HttpRequestHint,
  HttpCheckResult,
  IpCheckResult,
  ModuleError,
  ProbeExecutionInput,
  ProbeExecutionResult,
  ProbeResult,
  ProbeVantage,
  RateLimitTier,
  ResolvedTarget,
  TcpCheckResult,
  TurnstileVerificationInput
} from "./types";

type AppDeps = {
  probePort(input: ProbeExecutionInput): Promise<ProbeExecutionResult>;
  verifyTurnstile(input: TurnstileVerificationInput): Promise<{ success: boolean; errors: string[] }>;
  resolveTarget(rawTarget: string, timeoutMs: number): Promise<ResolvedTarget>;
  runDnsCheck(target: ResolvedTarget, timeoutMs: number): Promise<DnsCheckResult>;
  runHttpCheck(
    target: ResolvedTarget,
    port: number | undefined,
    timeoutMs: number,
    hint?: HttpRequestHint
  ): Promise<HttpCheckResult>;
  runIpCheck(target: ResolvedTarget, timeoutMs: number): Promise<IpCheckResult>;
};

type ResponseHeaders = Record<string, string>;
type ResponseView = "minimal" | "full";
type ResponseFormat = "json" | "plain" | "boolean";

const moduleEnum = z.enum(["tcp", "dns", "http", "ip", "udp"]);

const checkRequestSchema = z.object({
  target: z.string().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  modules: z.array(moduleEnum).min(1).max(5).optional(),
  timeoutMs: z.coerce.number().int().min(250).max(10_000).default(3_000),
  http: z
    .object({
      scheme: z.enum(["http", "https"]).optional(),
      method: z.enum(["HEAD", "GET"]).optional()
    })
    .optional(),
  turnstileToken: z.string().min(1).optional()
});

const webCheckRequestSchema = checkRequestSchema.extend({
  turnstileToken: z.string().min(1)
});

const probeCompatibilitySchema = z.object({
  target: z.string().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535),
  timeoutMs: z.coerce.number().int().min(250).max(10_000).default(3_000),
  turnstileToken: z.string().min(1).optional()
});

function getVantage(env: AppBindings): ProbeVantage {
  return {
    id: env.CANONICAL_VANTAGE_ID ?? "canonical-edge-lhr",
    label: env.CANONICAL_VANTAGE_LABEL ?? "Canonical Cloudflare vantage near London",
    regionHint: env.CANONICAL_VANTAGE_REGION ?? "aws:eu-west-2"
  };
}

function getProbeExplanation(status: ProbeExecutionResult["status"]): string {
  switch (status) {
    case "open":
      return "The TCP handshake completed from the public probe vantage, so the port appears reachable.";
    case "closed":
      return "The target actively refused the TCP connection, which usually means the host is reachable but nothing is listening on that port.";
    case "timeout":
      return "The connection attempt timed out. In practice this often means filtering, packet drops, or a path that never completed the handshake.";
  }
}

function jsonHeaders(extra: ResponseHeaders = {}): ResponseHeaders {
  return {
    "cache-control": "no-store",
    ...extra
  };
}

function jsonError(
  c: {
    json(payload: unknown, status?: number, headers?: ResponseHeaders): Response;
  },
  status: number,
  code: string,
  message: string,
  details?: string[],
  headers: ResponseHeaders = {}
): Response {
  return c.json(
    {
      error: {
        code,
        message,
        details
      }
    },
    status,
    jsonHeaders(headers)
  );
}

function buildApiCatalog(origin: string) {
  return {
    linkset: [
      {
        anchor: origin,
        item: [
          {
            href: `${origin}/api/openapi.json`,
            rel: "service-desc",
            type: "application/openapi+json"
          },
          {
            href: `${origin}/docs/api`,
            rel: "service-doc",
            type: "text/html"
          },
          {
            href: `${origin}/api/health`,
            rel: "status",
            type: "application/json"
          }
        ]
      }
    ]
  };
}

function buildOpenApi(origin: string) {
  return {
    ...openApiDocument,
    servers: [{ url: origin }]
  };
}

function withCors(response: Response): Response {
  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("access-control-allow-headers", "content-type, authorization");
  response.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  return response;
}

function rateHeaders(tier: RateLimitTier, cost: number): ResponseHeaders {
  return {
    "x-kordu-rate-limit-tier": tier,
    "x-kordu-rate-limit-cost": String(cost)
  };
}

function parseResponseView(preferHeader: string | undefined, viewParam: string | null): ResponseView {
  if (viewParam === "full") return "full";
  if (viewParam === "minimal") return "minimal";

  if (preferHeader?.includes("return=representation")) {
    return "full";
  }

  return "minimal";
}

function parseResponseFormat(formatParam: string | null): ResponseFormat {
  if (formatParam === "plain") return "plain";
  if (formatParam === "boolean") return "boolean";
  return "json";
}

function withPreferenceHeaders(headers: ResponseHeaders, view: ResponseView): ResponseHeaders {
  if (view !== "minimal") {
    return headers;
  }

  return {
    ...headers,
    "preference-applied": "return=minimal"
  };
}

function toNormalizedTarget(target: ResolvedTarget): CheckResponse["normalized"] {
  return {
    input: target.input,
    value: target.normalizedTarget,
    kind: target.targetKind,
    hostname: target.hostname,
    ip: target.ip
  };
}

function toTcpResult(probe: ProbeExecutionResult, port: number): TcpCheckResult {
  return {
    status: probe.status,
    moduleStatus: probe.status === "timeout" ? "timeout" : "ok",
    latencyMs: probe.latencyMs,
    explanation: getProbeExplanation(probe.status),
    port
  };
}

function toLegacyProbeResult(check: CheckResponse, port: number): ProbeResult {
  const tcp = check.results.tcp;

  if (!tcp) {
    throw new ProbeConfigurationError("TCP module did not execute for compatibility response.");
  }

  return {
    status: tcp.status,
    latencyMs: tcp.latencyMs,
    target: check.target,
    resolvedAddress: check.resolvedAddresses[0] ?? null,
    explanation: tcp.explanation,
    commands: buildProbeCommands(check.normalized.hostname ?? check.normalized.ip ?? check.target, port),
    vantage: check.vantage
  };
}

function createUnsupportedUdpResult() {
  return {
    status: "unsupported" as const,
    reason: "Raw UDP probing is not supported on Cloudflare Workers in v1."
  };
}

function moduleSucceeded(moduleName: CheckModule, check: CheckResponse): boolean | null {
  switch (moduleName) {
    case "tcp":
      return check.results.tcp ? check.results.tcp.status === "open" : null;
    case "http":
      return check.results.http ? check.results.http.ok : null;
    case "dns":
      return check.results.dns ? check.results.dns.status === "ok" : null;
    case "ip":
      return check.results.ip ? check.results.ip.status === "ok" : null;
    case "udp":
      return check.results.udp ? false : null;
  }
}

function moduleStatus(moduleName: CheckModule, check: CheckResponse): string | null {
  switch (moduleName) {
    case "tcp":
      return check.results.tcp?.status ?? null;
    case "http":
      return check.results.http?.status ?? null;
    case "dns":
      return check.results.dns?.status ?? null;
    case "ip":
      return check.results.ip?.status ?? null;
    case "udp":
      return check.results.udp?.status ?? null;
  }
}

function singleModuleSummary(check: CheckResponse) {
  const [moduleName] = check.modules;

  if (!moduleName) {
    return {
      ok: check.errors.length === 0,
      target: check.target,
      status: "unknown"
    };
  }

  if (moduleName === "tcp" && check.results.tcp) {
    return {
      ok: check.results.tcp.status === "open",
      target: check.target,
      module: "tcp",
      status: check.results.tcp.status,
      latencyMs: check.results.tcp.latencyMs,
      port: check.results.tcp.port,
      ip: check.resolvedAddresses[0] ?? null
    };
  }

  if (moduleName === "http" && check.results.http) {
    return {
      ok: check.results.http.ok,
      target: check.target,
      module: "http",
      status: check.results.http.status,
      latencyMs: check.results.http.latencyMs,
      statusCode: check.results.http.statusCode,
      url: check.results.http.finalUrl ?? check.results.http.url
    };
  }

  if (moduleName === "dns" && check.results.dns) {
    const records = check.results.dns.records;
    const recordCount =
      records.a.length +
      records.aaaa.length +
      records.cname.length +
      records.mx.length +
      records.ns.length +
      records.txt.length;

    return {
      ok: check.results.dns.status === "ok",
      target: check.target,
      module: "dns",
      status: check.results.dns.status,
      records: recordCount
    };
  }

  if (moduleName === "ip" && check.results.ip) {
    return {
      ok: check.results.ip.status === "ok",
      target: check.target,
      module: "ip",
      status: check.results.ip.status,
      ip: check.results.ip.ip,
      ipVersion: check.results.ip.ipVersion
    };
  }

  if (moduleName === "udp" && check.results.udp) {
    return {
      ok: false,
      target: check.target,
      module: "udp",
      status: check.results.udp.status,
      reason: check.results.udp.reason
    };
  }

  return {
    ok: false,
    target: check.target,
    module: moduleName,
    status: "unavailable"
  };
}

function minimalCheckResponse(check: CheckResponse) {
  if (check.modules.length === 1) {
    return singleModuleSummary(check);
  }

  const checks = Object.fromEntries(
    check.modules.map((moduleName) => [moduleName, moduleStatus(moduleName, check)])
  );

  return {
    ok: check.modules.every((moduleName) => moduleSucceeded(moduleName, check) !== false) && check.errors.length === 0,
    target: check.target,
    checks
  };
}

function booleanCheckResponse(check: CheckResponse): boolean | null {
  if (check.modules.length !== 1) {
    return null;
  }

  const moduleName = check.modules[0]!;
  return moduleSucceeded(moduleName, check);
}

function createModuleError(module: CheckModule, code: string, message: string, retryable = false): ModuleError {
  return {
    module,
    code,
    message,
    retryable
  };
}

async function maybeVerifyTurnstile(
  c: { env: AppBindings; req: { header(name: string): string | undefined } },
  deps: AppDeps,
  token: string
): Promise<{ success: boolean; errors: string[] }> {
  const turnstileSecret = c.env.TURNSTILE_SECRET_KEY;

  if (!turnstileSecret) {
    console.error("Turnstile secret key is missing for website probe submissions.");
    throw new ProbeConfigurationError("Website checks are temporarily unavailable.");
  }

  return deps.verifyTurnstile({
    secretKey: turnstileSecret,
    token,
    remoteIp: c.req.header("cf-connecting-ip") ?? "unknown-client",
    ...(c.env.TURNSTILE_EXPECTED_HOSTNAME
      ? { expectedHostname: c.env.TURNSTILE_EXPECTED_HOSTNAME }
      : {}),
    expectedAction: "probe"
  });
}

function toCheckRequest(body: {
  target: string;
  port?: number | undefined;
  modules?: CheckModule[] | undefined;
  timeoutMs?: number | undefined;
  http?: {
    scheme?: HttpRequestHint["scheme"] | undefined;
    method?: HttpRequestHint["method"] | undefined;
  } | undefined;
  turnstileToken?: string | undefined;
}): CheckRequest {
  const http =
    body.http
      ? {
          ...(body.http.scheme ? { scheme: body.http.scheme } : {}),
          ...(body.http.method ? { method: body.http.method } : {})
        }
      : undefined;

  return {
    target: body.target,
    ...(typeof body.port === "number" ? { port: body.port } : {}),
    ...(body.modules ? { modules: body.modules } : {}),
    ...(typeof body.timeoutMs === "number" ? { timeoutMs: body.timeoutMs } : {}),
    ...(http && Object.keys(http).length > 0 ? { http } : {}),
    ...(body.turnstileToken ? { turnstileToken: body.turnstileToken } : {})
  };
}

async function executeCheck(body: CheckRequest, deps: AppDeps, env: AppBindings): Promise<CheckResponse> {
  const timeoutMs = clampTimeout(body.timeoutMs);
  const target = await deps.resolveTarget(body.target, timeoutMs);
  const modules = getRequestedModules(body, target);
  const results: CheckResponse["results"] = {};
  const errors: ModuleError[] = [];

  if (modules.includes("udp")) {
    results.udp = createUnsupportedUdpResult();
  }

  const tasks = modules.map(async (moduleName) => {
    try {
      switch (moduleName) {
        case "dns":
          results.dns = await deps.runDnsCheck(target, timeoutMs);
          return;
        case "ip":
          results.ip = await deps.runIpCheck(target, timeoutMs);
          return;
        case "http":
          results.http = await deps.runHttpCheck(target, body.port, timeoutMs, body.http);
          return;
        case "tcp":
          if (typeof body.port !== "number") {
            errors.push(createModuleError("tcp", "port_required", "TCP checks require a port."));
            return;
          }

          if (body.port === 25) {
            errors.push(
              createModuleError("tcp", "port_blocked", "Port 25 cannot be probed from Cloudflare Workers.")
            );
            return;
          }

          {
            const probe = await deps.probePort({
              target: target.primaryAddress ?? target.normalizedTarget,
              port: body.port,
              timeoutMs
            });
            results.tcp = toTcpResult(probe, body.port);
          }
          return;
        case "udp":
          return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Module execution failed.";
      const isInvalidTarget = error instanceof InvalidTargetError;
      const isTimeout = error instanceof OperationTimeoutError;
      errors.push(
        createModuleError(
          moduleName,
          isInvalidTarget ? "invalid_target" : isTimeout ? "module_timeout" : "module_failed",
          message,
          !isInvalidTarget
        )
      );

      if (moduleName === "dns") {
        results.dns = {
          status: isTimeout ? "timeout" : "failed",
          resolver: "node:dns",
          hostname: target.hostname,
          reverseNames: [],
          records: emptyRecords()
        };
      }

      if (moduleName === "ip") {
        results.ip = {
          status: isTimeout ? "timeout" : "failed",
          subject: target.hostname ?? target.primaryAddress ?? target.normalizedTarget,
          ip: target.targetKind === "ip" ? target.normalizedTarget : target.primaryAddress,
          ipVersion: target.primaryAddress?.includes(":") ? "IPv6" : target.primaryAddress ? "IPv4" : null,
          reverseNames: [],
          rdap: null,
          source: "rdap.org+node:dns"
        };
      }

      if (moduleName === "http") {
        results.http = {
          status: isTimeout ? "timeout" : "failed",
          scheme: body.http?.scheme ?? (body.port === 80 ? "http" : "https"),
          method: body.http?.method ?? "HEAD",
          url: "",
          finalUrl: null,
          statusCode: null,
          ok: false,
          latencyMs: null,
          redirectChain: []
        };
      }
    }
  });

  await Promise.all(tasks);

  const commands: CheckResponse["commands"] = {};

  if (typeof body.port === "number" && results.tcp) {
    commands.tcp = buildProbeCommands(target.hostname ?? target.primaryAddress ?? target.normalizedTarget, body.port);
  }

  if (results.http) {
    commands.http = buildHttpCommands(
      target.hostname ?? target.primaryAddress ?? target.normalizedTarget,
      body.port,
      results.http.scheme,
      results.http.method
    );
  }

  const response: CheckResponse = {
    target: target.normalizedTarget,
    normalized: toNormalizedTarget(target),
    resolvedAddresses: target.resolvedAddresses,
    vantage: getVantage(env),
    modules,
    results,
    errors,
    ...(Object.keys(commands).length > 0 ? { commands } : {})
  };

  env.PROBE_ANALYTICS?.writeDataPoint({
    indexes: [results.tcp?.status ?? "non-tcp"],
    blobs: [
      modules.join(","),
      String(body.port ?? 0),
      target.targetKind,
      response.vantage.id
    ],
    doubles: [
      results.tcp?.latencyMs ?? results.http?.latencyMs ?? 0
    ]
  });

  return response;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204, headers: jsonHeaders() }));
    }

    await next();
    return withCors(c.res);
  });

  app.onError((error, c) => {
    if (error instanceof InvalidTargetError) {
      return jsonError(c, 400, "invalid_target", error.message);
    }

    if (error instanceof OperationTimeoutError) {
      return jsonError(c, 504, "timeout", error.message);
    }

    if (error instanceof ProbeConfigurationError) {
      return jsonError(c, 500, "configuration_error", error.message);
    }

    console.error("Unhandled application error", error);
    return jsonError(c, 500, "internal_error", "Probe execution failed unexpectedly.");
  });

  app.notFound((c) => jsonError(c, 404, "not_found", "Route not found."));

  app.get("/api/health", (c) =>
    c.json(
      {
        ok: true,
        service: "kordu-probe",
        mode: "connectivity-suite",
        modules: ["tcp", "dns", "http", "ip"],
        unsupported: ["udp"]
      },
      200,
      jsonHeaders()
    )
  );

  app.get("/api/openapi.json", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(buildOpenApi(origin), 200, jsonHeaders({
      "content-type": "application/openapi+json; charset=utf-8"
    }));
  });

  app.get("/.well-known/api-catalog", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json(buildApiCatalog(origin), 200, jsonHeaders({
      "content-type": "application/linkset+json; charset=utf-8"
    }));
  });

  app.post("/api/check", zValidator("json", checkRequestSchema), async (c) => {
    const body = c.req.valid("json");
    const checkRequest = toCheckRequest(body);
    const requestUrl = new URL(c.req.url);
    const view = parseResponseView(c.req.header("prefer"), requestUrl.searchParams.get("view"));
    const format = parseResponseFormat(requestUrl.searchParams.get("format"));
    const timeoutMs = clampTimeout(body.timeoutMs);
    const normalizedTarget = normalizeTargetInput(body.target);
    const modules = getRequestedModulesForTargetKind(checkRequest, normalizedTarget.targetKind);
    const tier = getRateLimitTier(modules);
    const cost = getRateLimitCost(modules);
    const rateLimiter = getRateLimitBinding(c.env, tier);
    const clientIp = c.req.header("cf-connecting-ip") ?? "unknown-client";

    if (rateLimiter) {
      const { success } = await rateLimiter.limit({ key: clientIp });

      if (!success) {
        return jsonError(
          c,
          429,
          "rate_limited",
          "Rate limit exceeded. Try again shortly.",
          undefined,
          {
            ...rateHeaders(tier, cost),
            "retry-after": "60"
          }
        );
      }
    }

    const preResolved = await deps.resolveTarget(body.target, timeoutMs);
    const result = await executeCheck(checkRequest, {
      ...deps,
      resolveTarget: () => Promise.resolve(preResolved)
    }, c.env);

    if (view === "full") {
      return c.json(result, 200, jsonHeaders(rateHeaders(tier, cost)));
    }

    if (format === "boolean") {
      const boolValue = booleanCheckResponse(result);

      if (boolValue === null) {
        return jsonError(
          c,
          400,
          "boolean_format_requires_single_module",
          "format=boolean only supports requests that resolve to a single module."
        );
      }

      return new Response(boolValue ? "true\n" : "false\n", {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...jsonHeaders(withPreferenceHeaders(rateHeaders(tier, cost), view))
        }
      });
    }

    if (format === "plain") {
      if (result.modules.length !== 1) {
        return jsonError(
          c,
          400,
          "plain_format_requires_single_module",
          "format=plain only supports requests that resolve to a single module."
        );
      }

      const plainStatus = moduleStatus(result.modules[0]!, result) ?? "unknown";
      return new Response(`${plainStatus}\n`, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...jsonHeaders(withPreferenceHeaders(rateHeaders(tier, cost), view))
        }
      });
    }

    return c.json(
      minimalCheckResponse(result),
      200,
      jsonHeaders(withPreferenceHeaders(rateHeaders(tier, cost), view))
    );
  });

  app.post("/api/check/web", zValidator("json", webCheckRequestSchema), async (c) => {
    const body = c.req.valid("json");
    const checkRequest = toCheckRequest(body);
    const clientIp = c.req.header("cf-connecting-ip") ?? "unknown-client";
    const timeoutMs = clampTimeout(body.timeoutMs);
    const normalizedTarget = normalizeTargetInput(body.target);
    const modules = getRequestedModulesForTargetKind(checkRequest, normalizedTarget.targetKind);
    const tier = getRateLimitTier(modules);
    const cost = getRateLimitCost(modules);
    const rateLimiter = getRateLimitBinding(c.env, tier);

    if (rateLimiter) {
      const { success } = await rateLimiter.limit({ key: clientIp });

      if (!success) {
        return jsonError(
          c,
          429,
          "rate_limited",
          "Rate limit exceeded. Try again shortly.",
          undefined,
          {
            ...rateHeaders(tier, cost),
            "retry-after": "60"
          }
        );
      }
    }

    const turnstile = await maybeVerifyTurnstile(c, deps, body.turnstileToken);

    if (!turnstile.success) {
      return jsonError(
        c,
        403,
        "turnstile_invalid",
        "Turnstile validation failed. Refresh the challenge and try again.",
        turnstile.errors
      );
    }

    const preResolved = await deps.resolveTarget(body.target, timeoutMs);
    const result = await executeCheck(checkRequest, {
      ...deps,
      resolveTarget: () => Promise.resolve(preResolved)
    }, c.env);

    return c.json(result, 200, jsonHeaders(rateHeaders(tier, cost)));
  });

  app.post("/api/probe", zValidator("json", probeCompatibilitySchema), async (c) => {
    const body = c.req.valid("json");
    const requestUrl = new URL(c.req.url);
    const view = parseResponseView(c.req.header("prefer"), requestUrl.searchParams.get("view"));
    const format = parseResponseFormat(requestUrl.searchParams.get("format"));
    const timeoutMs = clampTimeout(body.timeoutMs);
    const checkBody: CheckRequest = toCheckRequest({
      target: body.target,
      port: body.port,
      timeoutMs,
      modules: ["tcp"]
    });

    const tier = getRateLimitTier(["tcp"]);
    const cost = getRateLimitCost(["tcp"]);
    const rateLimiter = getRateLimitBinding(c.env, tier);
    const clientIp = c.req.header("cf-connecting-ip") ?? "unknown-client";

    if (rateLimiter) {
      const { success } = await rateLimiter.limit({ key: clientIp });

      if (!success) {
        return jsonError(
          c,
          429,
          "rate_limited",
          "Rate limit exceeded. Try again shortly.",
          undefined,
          {
            ...rateHeaders(tier, cost),
            "retry-after": "60"
          }
        );
      }
    }

    const preResolved = await deps.resolveTarget(checkBody.target, timeoutMs);
    const checkResult = await executeCheck(checkBody, {
      ...deps,
      resolveTarget: () => Promise.resolve(preResolved)
    }, c.env);

    const tcpError = checkResult.errors.find((error) => error.module === "tcp");

    if (!checkResult.results.tcp && tcpError) {
      return jsonError(
        c,
        tcpError.code === "invalid_target" ? 400 : 502,
        tcpError.code,
        tcpError.message
      );
    }

    if (view === "full") {
      return c.json(toLegacyProbeResult(checkResult, body.port), 200, jsonHeaders(rateHeaders(tier, cost)));
    }

    if (format === "boolean") {
      const boolValue = booleanCheckResponse(checkResult);
      return new Response(boolValue ? "true\n" : "false\n", {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...jsonHeaders(withPreferenceHeaders(rateHeaders(tier, cost), view))
        }
      });
    }

    if (format === "plain") {
      const plainStatus = checkResult.results.tcp?.status ?? "unknown";
      return new Response(`${plainStatus}\n`, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...jsonHeaders(withPreferenceHeaders(rateHeaders(tier, cost), view))
        }
      });
    }

    return c.json(
      minimalCheckResponse(checkResult),
      200,
      jsonHeaders(withPreferenceHeaders(rateHeaders(tier, cost), view))
    );
  });

  return app;
}
