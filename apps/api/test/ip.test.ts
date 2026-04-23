import dns from "node:dns/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runIpCheck } from "../src/lib/ip";
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

describe("IP checks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("does not parse oversized RDAP responses", async () => {
    vi.spyOn(dns, "reverse").mockResolvedValue([]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          objectClassName: "ip network",
          handle: "oversized"
        }),
        {
          status: 200,
          headers: {
            "content-length": "65536",
            "content-type": "application/rdap+json"
          }
        }
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runIpCheck(publicIpTarget, 1_000);

    expect(result.rdap).toBeNull();
  });
});
