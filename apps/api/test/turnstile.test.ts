import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstileToken } from "../src/lib/turnstile";

const originalFetch = globalThis.fetch;

describe("Turnstile verification", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("times out slow Siteverify calls", async () => {
    globalThis.fetch = vi.fn(() => new Promise<never>(() => {})) as unknown as typeof fetch;

    const verification = verifyTurnstileToken({
      secretKey: "secret",
      token: "token",
      remoteIp: null,
      timeoutMs: 1
    });

    await expect(verification).resolves.toEqual({
      success: false,
      errors: ["siteverify_timeout"]
    });
  });
});
