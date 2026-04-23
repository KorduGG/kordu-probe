import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const runtimePath = path.resolve(import.meta.dirname, "..", "src", "scripts", "probe-form.js");

describe("probe form runtime", () => {
  it("uses a supported Turnstile execution flow for invisible widgets", () => {
    const runtime = readFileSync(runtimePath, "utf8");

    expect(runtime).toContain('execution: "execute"');
    expect(runtime).toMatch(/\.execute\(/u);
    expect(runtime).not.toContain('size: "invisible"');
  });
});
