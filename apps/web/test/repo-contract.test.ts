import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ciWorkflowPath = path.resolve(import.meta.dirname, "..", "..", "..", ".github", "workflows", "ci.yml");

describe("repository validation contract", () => {
  it("runs CI on pull requests, main pushes, and manual dispatch", () => {
    const workflow = readFileSync(ciWorkflowPath, "utf8");

    expect(workflow).toMatch(/\bpull_request:/);
    expect(workflow).toMatch(/\bpush:/);
    expect(workflow).toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(workflow).toMatch(/\bworkflow_dispatch:/);
    expect(workflow).toMatch(/actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/);
    expect(workflow).toMatch(/node-version:\s*"24"/);
    expect(workflow).toMatch(/run:\s*bun run test/);
    expect(workflow).toContain("PUBLIC_TURNSTILE_SITE_KEY: 1x00000000000000000000AA");
  });
});
