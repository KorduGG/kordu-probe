import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const wranglerConfigPath = path.resolve(import.meta.dirname, "..", "wrangler.jsonc");

describe("Worker configuration", () => {
  it("keeps explicit spend guardrails enabled", () => {
    const config = JSON.parse(readFileSync(wranglerConfigPath, "utf8")) as {
      limits?: { cpu_ms?: number; subrequests?: number };
      vars?: { ANALYTICS_SAMPLE_RATE?: string };
      observability?: {
        logs?: { enabled?: boolean; head_sampling_rate?: number; invocation_logs?: boolean };
        traces?: { enabled?: boolean; head_sampling_rate?: number };
      };
    };

    expect(config.limits?.cpu_ms).toBeLessThanOrEqual(10);
    expect(config.limits?.subrequests).toBeLessThanOrEqual(12);
    expect(config.observability?.logs?.enabled).toBe(true);
    expect(config.observability?.logs?.head_sampling_rate).toBeLessThanOrEqual(0.01);
    expect(config.observability?.logs?.invocation_logs).toBe(false);
    expect(config.observability?.traces?.enabled).toBe(false);
    expect(config.observability?.traces?.head_sampling_rate).toBeLessThanOrEqual(0.01);
    expect(config.vars?.ANALYTICS_SAMPLE_RATE).toBe("0");
  });
});
