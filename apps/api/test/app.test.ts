import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    TURNSTILE_SECRET_KEY: "test-secret",
    TURNSTILE_EXPECTED_HOSTNAME: "probe.kordu.tools",
    CANONICAL_VANTAGE_ID: "canonical-edge-lhr",
    CANONICAL_VANTAGE_LABEL: "Canonical Cloudflare vantage near London",
    CANONICAL_VANTAGE_REGION: "aws:eu-west-2",
    CHECK_RATE_LIMIT_LIGHT: {
      limit: vi.fn().mockResolvedValue({ success: true })
    },
    CHECK_RATE_LIMIT_STANDARD: {
      limit: vi.fn().mockResolvedValue({ success: true })
    },
    CHECK_RATE_LIMIT_HEAVY: {
      limit: vi.fn().mockResolvedValue({ success: true })
    },
    PROBE_RATE_LIMITER: {
      limit: vi.fn().mockResolvedValue({ success: true })
    },
    PROBE_ANALYTICS: {
      writeDataPoint: vi.fn()
    },
    ...overrides
  };
}

function createDeps() {
  return {
    resolveTarget: vi.fn().mockResolvedValue({
      input: "example.com",
      normalizedTarget: "example.com",
      targetKind: "domain",
      hostname: "example.com",
      ip: null,
      resolvedAddresses: ["93.184.216.34"],
      primaryAddress: "93.184.216.34"
    }),
    probePort: vi.fn().mockResolvedValue({ status: "open", latencyMs: 41 }),
    verifyTurnstile: vi.fn().mockResolvedValue({ success: true, errors: [] }),
    runDnsCheck: vi.fn().mockResolvedValue({
      status: "ok",
      resolver: "node:dns",
      hostname: "example.com",
      reverseNames: ["edge.example.com"],
      records: {
        a: ["93.184.216.34"],
        aaaa: [],
        cname: [],
        mx: [],
        ns: ["ns1.example.com"],
        txt: []
      }
    }),
    runHttpCheck: vi.fn().mockResolvedValue({
      status: "ok",
      scheme: "https",
      method: "HEAD",
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      statusCode: 200,
      ok: true,
      latencyMs: 73,
      redirectChain: []
    }),
    runIpCheck: vi.fn().mockResolvedValue({
      status: "ok",
      subject: "example.com",
      ip: "93.184.216.34",
      ipVersion: "IPv4",
      reverseNames: ["edge.example.com"],
      source: "rdap.org+node:dns",
      rdap: {
        objectClassName: "domain",
        handle: "EXAMPLE",
        name: "Example Inc.",
        country: "US",
        parentHandle: null,
        startAddress: null,
        endAddress: null,
        entities: []
      }
    })
  };
}

describe("connectivity API", () => {
  it("returns a minimal connectivity result without Turnstile for API clients", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp", "dns", "http", "ip"]
      })
    }, createEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-kordu-rate-limit-tier")).toBe("heavy");
    expect(response.headers.get("preference-applied")).toBe("return=minimal");
    const body = (await response.json()) as {
      ok: boolean;
      target: string;
      checks: Record<string, string>;
    };
    expect(body.ok).toBe(true);
    expect(body.target).toBe("example.com");
    expect(body.checks.tcp).toBe("open");
    expect(body.checks.http).toBe("ok");
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("returns the full response envelope when explicitly requested", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check?view=full", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp", "dns", "http", "ip"]
      })
    }, createEnv());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      modules: string[];
      results: { tcp?: { status: string }; http?: { statusCode: number } };
      commands?: { tcp?: { netcat: string } };
    };
    expect(body.modules).toContain("tcp");
    expect(body.results.tcp?.status).toBe("open");
    expect(body.results.http?.statusCode).toBe(200);
    expect(body.commands?.tcp?.netcat).toContain("nc -vz example.com 443");
  });

  it("returns boolean format for single-module checks", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check?format=boolean", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp"]
      })
    }, createEnv());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("true\n");
  });

  it("rejects boolean format for multi-module checks", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check?format=boolean", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp", "http"]
      })
    }, createEnv());

    expect(response.status).toBe(400);
  });

  it("requires Turnstile for the website check endpoint", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check/web", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        turnstileToken: "token"
      })
    }, createEnv());

    expect(response.status).toBe(200);
    expect(deps.verifyTurnstile).toHaveBeenCalledOnce();
  });

  it("defaults website port checks to the cheap TCP module only", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check/web", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        turnstileToken: "token"
      })
    }, createEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-kordu-rate-limit-tier")).toBe("light");
    const body = (await response.json()) as { modules: string[] };
    expect(body.modules).toEqual(["tcp"]);
    expect(deps.probePort).toHaveBeenCalledOnce();
    expect(deps.runDnsCheck).not.toHaveBeenCalled();
    expect(deps.runHttpCheck).not.toHaveBeenCalled();
    expect(deps.runIpCheck).not.toHaveBeenCalled();
  });

  it("maps failed Turnstile verification to 403 for website checks", async () => {
    const deps = createDeps();
    deps.verifyTurnstile.mockResolvedValueOnce({
      success: false,
      errors: ["timeout-or-duplicate"]
    });
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check/web", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        turnstileToken: "token"
      })
    }, createEnv());

    expect(response.status).toBe(403);
  });

  it("does not leak Turnstile secret configuration details to website users", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check/web", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        turnstileToken: "token"
      })
    }, createEnv({
      TURNSTILE_SECRET_KEY: undefined
    }));

    expect(response.status).toBe(500);
    const body = await response.json() as { error: { message: string } };
    expect(body.error.message).toBe("Website checks are temporarily unavailable.");
    expect(body.error.message).not.toContain("TURNSTILE_SECRET_KEY");
  });

  it("rejects rate-limited API requests before resolving targets", async () => {
    const deps = createDeps();
    const app = createApp(deps);
    const rateLimiter = {
      limit: vi.fn().mockResolvedValue({ success: false })
    };

    const response = await app.request("https://probe.kordu.tools/api/check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp"]
      })
    }, createEnv({
      CHECK_RATE_LIMIT_LIGHT: rateLimiter
    }));

    expect(response.status).toBe(429);
    expect(rateLimiter.limit).toHaveBeenCalledOnce();
    expect(deps.resolveTarget).not.toHaveBeenCalled();
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("does not write Analytics Engine datapoints unless sampling is enabled", async () => {
    const deps = createDeps();
    const app = createApp(deps);
    const analytics = {
      writeDataPoint: vi.fn()
    };

    const response = await app.request("https://probe.kordu.tools/api/check", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp"]
      })
    }, createEnv({
      PROBE_ANALYTICS: analytics
    }));

    expect(response.status).toBe(200);
    expect(analytics.writeDataPoint).not.toHaveBeenCalled();
  });

  it("writes sampled Analytics Engine datapoints when explicitly enabled", async () => {
    const deps = createDeps();
    const app = createApp(deps);
    const analytics = {
      writeDataPoint: vi.fn()
    };

    const response = await app.request("https://probe.kordu.tools/api/check", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        modules: ["tcp"]
      })
    }, createEnv({
      ANALYTICS_SAMPLE_RATE: "1",
      PROBE_ANALYTICS: analytics
    }));

    expect(response.status).toBe(200);
    expect(analytics.writeDataPoint).toHaveBeenCalledOnce();
  });

  it("rejects rate-limited website checks before Turnstile verification", async () => {
    const deps = createDeps();
    const app = createApp(deps);
    const rateLimiter = {
      limit: vi.fn().mockResolvedValue({ success: false })
    };

    const response = await app.request("https://probe.kordu.tools/api/check/web", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443,
        turnstileToken: "token"
      })
    }, createEnv({
      CHECK_RATE_LIMIT_LIGHT: rateLimiter
    }));

    expect(response.status).toBe(429);
    expect(rateLimiter.limit).toHaveBeenCalledOnce();
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(deps.resolveTarget).not.toHaveBeenCalled();
  });

  it("returns UDP as unsupported without failing the whole request", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/check", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        modules: ["udp", "dns"]
      })
    }, createEnv());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      checks: Record<string, string>;
    };
    expect(body.checks.udp).toBe("unsupported");
  });

  it("keeps /api/probe as a TCP compatibility alias", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/probe?view=full", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443
      })
    }, createEnv());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      commands: { netcat: string };
    };
    expect(body.status).toBe("open");
    expect(body.commands.netcat).toContain("nc -vz example.com 443");
  });

  it("returns a minimal tcp summary from /api/probe by default", async () => {
    const deps = createDeps();
    const app = createApp(deps);

    const response = await app.request("https://probe.kordu.tools/api/probe", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        target: "example.com",
        port: 443
      })
    }, createEnv());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      module: string;
      status: string;
    };
    expect(body.ok).toBe(true);
    expect(body.module).toBe("tcp");
    expect(body.status).toBe("open");
  });
});
