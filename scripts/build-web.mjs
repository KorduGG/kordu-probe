import { spawnSync } from "node:child_process";

import { resolveWebBuildEnv } from "./web-build-env.mjs";

const { env, webDir } = resolveWebBuildEnv();

const result = spawnSync("bunx", ["astro", "build"], {
  cwd: webDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
