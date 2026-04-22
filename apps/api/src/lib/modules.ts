import type { AppBindings, CheckModule, CheckRequest, RateLimitBinding, RateLimitTier, ResolvedTarget, TargetKind } from "../types";

const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 250;

export function clampTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || Number.isNaN(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(timeoutMs)));
}

export function getRequestedModulesForTargetKind(request: CheckRequest, targetKind: TargetKind): CheckModule[] {
  const explicit = request.modules?.length
    ? Array.from(new Set(request.modules))
    : [];

  if (explicit.length > 0) {
    return explicit;
  }

  const modules: CheckModule[] = ["ip"];

  if (targetKind === "domain") {
    modules.unshift("dns");
  }

  if (typeof request.port === "number") {
    modules.push("tcp");
  }

  if (request.http?.scheme || request.port === 80 || request.port === 443) {
    modules.push("http");
  }

  return Array.from(new Set(modules));
}

export function getRequestedModules(request: CheckRequest, resolvedTarget: ResolvedTarget): CheckModule[] {
  return getRequestedModulesForTargetKind(request, resolvedTarget.targetKind);
}

export function getRateLimitTier(modules: CheckModule[]): RateLimitTier {
  const supported = modules.filter((moduleName) => moduleName !== "udp");

  if (supported.includes("http") && supported.length >= 3) {
    return "heavy";
  }

  if (supported.length >= 3) {
    return "heavy";
  }

  if (supported.length === 2) {
    return "standard";
  }

  return "light";
}

export function getRateLimitBinding(env: AppBindings, tier: RateLimitTier): RateLimitBinding | undefined {
  switch (tier) {
    case "light":
      return env.CHECK_RATE_LIMIT_LIGHT ?? env.PROBE_RATE_LIMITER;
    case "standard":
      return env.CHECK_RATE_LIMIT_STANDARD ?? env.PROBE_RATE_LIMITER;
    case "heavy":
      return env.CHECK_RATE_LIMIT_HEAVY ?? env.PROBE_RATE_LIMITER;
  }
}

export function getRateLimitCost(modules: CheckModule[]): number {
  return modules.reduce((cost, moduleName) => {
    switch (moduleName) {
      case "http":
        return cost + 3;
      case "dns":
      case "ip":
        return cost + 2;
      case "udp":
        return cost + 0;
      case "tcp":
      default:
        return cost + 1;
    }
  }, 0);
}
