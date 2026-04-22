import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

import { resolveWebBuildEnv } from "./web-build-env.mjs";

const { env, webDir } = resolveWebBuildEnv();
const distDir = path.join(webDir, "dist");

for (const stalePath of [
  path.join(distDir, "SECURITY"),
  path.join(distDir, "security")
]) {
  rmSync(stalePath, { recursive: true, force: true });
}

const result = spawnSync("bunx", ["astro", "build"], {
  cwd: webDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  throw result.error;
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(result.status ?? 1);
