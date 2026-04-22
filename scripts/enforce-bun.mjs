const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.includes("bun/")) {
  console.error("Kordu Probe uses Bun as its package manager.");
  console.error("Install dependencies with `bun install` and run scripts with `bun run ...`.");
  process.exit(1);
}
