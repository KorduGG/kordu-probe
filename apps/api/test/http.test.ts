import { afterEach, describe, expect, it, vi } from "vitest";

import { runHttpCheck } from "../src/lib/http";
import type { ResolvedTarget } from "../src/types";

const originalFetch = globalThis.fetch;

const publicIpTarget: ResolvedTarget = {
  input: "93.184.216.34",
  normalizedTarget: "93.184.216.34",
  targetKind: "ip",
  hostname: null,
  ip: "93.184.216.34",
  resolvedAddresses: ["93.184.216.34"],
  primaryAddress: "93.184.216.34"
};

describe("HTTP checks", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not follow redirects to private addresses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "http://127.0.0.1/"
        }
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runHttpCheck(publicIpTarget, 443, 1_000, { scheme: "https" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.finalUrl).toBe("http://127.0.0.1/");
    expect(result.redirectChain).toHaveLength(1);
  });

  it("does not follow redirects to non-HTTP schemes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "file:///etc/passwd"
        }
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runHttpCheck(publicIpTarget, 443, 1_000, { scheme: "https" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.finalUrl).toBe("file:///etc/passwd");
  });
});
