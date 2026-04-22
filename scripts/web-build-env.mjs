import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(__dirname, "..");

function parseDotEnv(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (!isQuoted) {
      value = value.replace(/\s+#.*$/u, "").trim();
    }

    if (isQuoted) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function readEnvFileContents(envFilePath) {
  const file = readFileSync(envFilePath);

  if (file.length >= 2 && file[0] === 0xff && file[1] === 0xfe) {
    return file.toString("utf16le");
  }

  if (file.includes(0x00)) {
    return file.toString("utf16le");
  }

  return file.toString("utf8");
}

export function resolveWebBuildEnv({
  projectRoot = defaultProjectRoot,
  env = process.env
} = {}) {
  const webDir = path.join(projectRoot, "apps", "web");
  const envFilePath = path.join(webDir, ".env");
  const resolvedEnv = { ...env };

  if (existsSync(envFilePath)) {
    const envFile = parseDotEnv(readEnvFileContents(envFilePath));
    for (const [key, value] of Object.entries(envFile)) {
      if (resolvedEnv[key] === undefined || resolvedEnv[key] === "") {
        resolvedEnv[key] = value;
      }
    }
  }

  if (!resolvedEnv.PUBLIC_TURNSTILE_SITE_KEY) {
    throw new Error(
      "PUBLIC_TURNSTILE_SITE_KEY must be set in apps/web/.env or the current shell environment before running a production web build."
    );
  }

  return {
    env: resolvedEnv,
    envFilePath,
    webDir
  };
}
