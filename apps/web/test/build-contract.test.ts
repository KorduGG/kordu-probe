import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const helperUrl = pathToFileURL(
  path.resolve(import.meta.dirname, "..", "..", "..", "scripts", "web-build-env.mjs")
).href;

async function loadHelper() {
  return await import(helperUrl);
}

function createTempProject(envFileContents?: string) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "kordu-probe-web-env-"));
  const webDir = path.join(projectRoot, "apps", "web");
  mkdirSync(webDir, { recursive: true });
  if (envFileContents !== undefined) {
    writeFileSync(path.join(webDir, ".env"), envFileContents);
  }
  return { projectRoot, webDir };
}

describe("web build env contract", () => {
  it("loads PUBLIC_TURNSTILE_SITE_KEY from apps/web/.env when the shell env is empty", async () => {
    const helper = await loadHelper();

    const { projectRoot } = createTempProject("PUBLIC_TURNSTILE_SITE_KEY=test-site-key\n");
    const resolved = helper.resolveWebBuildEnv({ projectRoot, env: {} });

    expect(resolved.env.PUBLIC_TURNSTILE_SITE_KEY).toBe("test-site-key");
    expect(resolved.envFilePath).toBe(path.join(projectRoot, "apps", "web", ".env"));
  });

  it("prefers an explicitly provided shell env over the apps/web/.env file", async () => {
    const helper = await loadHelper();

    const { projectRoot } = createTempProject("PUBLIC_TURNSTILE_SITE_KEY=file-site-key\n");
    const resolved = helper.resolveWebBuildEnv({
      projectRoot,
      env: { PUBLIC_TURNSTILE_SITE_KEY: "shell-site-key" }
    });

    expect(resolved.env.PUBLIC_TURNSTILE_SITE_KEY).toBe("shell-site-key");
  });

  it("throws a stable preflight error when PUBLIC_TURNSTILE_SITE_KEY is absent", async () => {
    const helper = await loadHelper();

    const { projectRoot } = createTempProject();

    expect(() => helper.resolveWebBuildEnv({ projectRoot, env: {} })).toThrow(
      /PUBLIC_TURNSTILE_SITE_KEY must be set in apps\/web\/\.env or the current shell environment/
    );
  });
});
