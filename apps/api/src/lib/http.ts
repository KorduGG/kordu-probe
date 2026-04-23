import { formatHostForUrl, normalizeTargetInput, resolvePublicAddresses } from "./targets";
import type {
  HttpCheckResult,
  HttpMethod,
  HttpRequestHint,
  HttpScheme,
  ResolvedTarget
} from "../types";

const MAX_REDIRECTS = 5;

function getScheme(port: number | undefined, hint: HttpRequestHint | undefined): HttpScheme {
  if (hint?.scheme) {
    return hint.scheme;
  }

  if (port === 80) {
    return "http";
  }

  return "https";
}

function getMethod(hint: HttpRequestHint | undefined): HttpMethod {
  return hint?.method ?? "HEAD";
}

function buildInitialUrl(target: ResolvedTarget, scheme: HttpScheme, port?: number): string {
  const host = target.hostname ?? target.primaryAddress ?? target.normalizedTarget;
  const formattedHost = formatHostForUrl(host);
  const defaultPort = scheme === "https" ? 443 : 80;
  const portSuffix = port && port !== defaultPort ? `:${port}` : "";
  return `${scheme}://${formattedHost}${portSuffix}/`;
}

function locationFrom(headers: Headers): string | null {
  return headers.get("location");
}

function resolveNextUrl(currentUrl: string, location: string | null): string | null {
  if (!location) {
    return null;
  }

  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

async function isAllowedHttpUrl(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const parsed = new URL(url);

    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
      return false;
    }

    const target = normalizeTargetInput(parsed.hostname);

    if (target.targetKind === "domain") {
      return (await resolvePublicAddresses(target.normalizedTarget, timeoutMs)).length > 0;
    }

    return true;
  } catch {
    return false;
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best-effort cleanup only; failed cancellation should not mask probe results.
  }
}

async function fetchWithTimeout(
  url: string,
  method: HttpMethod,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "Kordu Probe/0.2 (+https://probe.kordu.tools)"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHttpCheck(
  target: ResolvedTarget,
  port: number | undefined,
  timeoutMs: number,
  hint?: HttpRequestHint
): Promise<HttpCheckResult> {
  const scheme = getScheme(port, hint);
  let method = getMethod(hint);
  let currentUrl = buildInitialUrl(target, scheme, port);
  const redirectChain: HttpCheckResult["redirectChain"] = [];
  const startedAt = Date.now();

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    try {
      const response = await fetchWithTimeout(currentUrl, method, timeoutMs);

      if ((response.status === 405 || response.status === 501) && method === "HEAD") {
        await cancelResponseBody(response);
        method = "GET";
        continue;
      }

      const location = locationFrom(response.headers);
      redirectChain.push({
        url: currentUrl,
        statusCode: response.status,
        location
      });

      if (response.status >= 300 && response.status < 400 && location && redirectCount < MAX_REDIRECTS) {
        const nextUrl = resolveNextUrl(currentUrl, location);

        if (!nextUrl || !(await isAllowedHttpUrl(nextUrl, timeoutMs))) {
          await cancelResponseBody(response);
          return {
            status: "failed",
            scheme,
            method,
            url: buildInitialUrl(target, scheme, port),
            finalUrl: nextUrl ?? currentUrl,
            statusCode: response.status,
            ok: false,
            latencyMs: Date.now() - startedAt,
            redirectChain
          };
        }

        await cancelResponseBody(response);
        currentUrl = nextUrl;
        continue;
      }

      await cancelResponseBody(response);
      return {
        status: "ok",
        scheme,
        method,
        url: buildInitialUrl(target, scheme, port),
        finalUrl: currentUrl,
        statusCode: response.status,
        ok: response.ok,
        latencyMs: Date.now() - startedAt,
        redirectChain
      };
    } catch (error) {
      if (String(error).includes("timeout") || (error instanceof Error && error.name === "AbortError")) {
        return {
          status: "timeout",
          scheme,
          method,
          url: buildInitialUrl(target, scheme, port),
          finalUrl: null,
          statusCode: null,
          ok: false,
          latencyMs: timeoutMs,
          redirectChain
        };
      }

      return {
        status: "failed",
        scheme,
        method,
        url: buildInitialUrl(target, scheme, port),
        finalUrl: null,
        statusCode: null,
        ok: false,
        latencyMs: Date.now() - startedAt,
        redirectChain
      };
    }
  }

  return {
    status: "failed",
    scheme,
    method,
    url: buildInitialUrl(target, scheme, port),
    finalUrl: currentUrl,
    statusCode: null,
    ok: false,
    latencyMs: Date.now() - startedAt,
    redirectChain
  };
}
