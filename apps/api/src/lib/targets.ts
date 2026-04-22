import dns from "node:dns/promises";
import { isIP } from "node:net";

import { InvalidTargetError } from "./errors";
import { withTimeout } from "./timeouts";
import type { ResolvedTarget, TargetKind } from "../types";

const hostnamePattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeTarget(target: string): string {
  return target.trim().replace(/^\[|\]$/g, "").toLowerCase();
}

function ipToNumber(ip: string): number {
  return ip.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function isInRange(ip: string, base: string, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipToNumber(ip) & mask) === (ipToNumber(base) & mask);
}

export function isPublicIpv4(ip: string): boolean {
  const blockedRanges = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ] as const;

  return !blockedRanges.some(([base, bits]) => isInRange(ip, base, bits));
}

export function isPublicIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  const ipv4MappedMatch = normalized.match(/^(?:[0-9a-f]{0,4}:)*ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);

  if (ipv4MappedMatch) {
    return isPublicIpv4(ipv4MappedMatch[1]);
  }

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8")
  ) {
    return false;
  }

  return true;
}

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    return isPublicIpv4(ip);
  }

  if (version === 6) {
    return isPublicIpv6(ip);
  }

  return false;
}

export function getTargetKind(target: string): TargetKind {
  return isIP(target) > 0 ? "ip" : "domain";
}

export function normalizeTargetInput(rawTarget: string): {
  input: string;
  normalizedTarget: string;
  targetKind: TargetKind;
  hostname: string | null;
  ip: string | null;
} {
  const target = normalizeTarget(rawTarget);

  if (!target) {
    throw new InvalidTargetError("Target is required.");
  }

  if (target === "localhost" || target.includes("/") || target.includes("://") || /\s/.test(target)) {
    throw new InvalidTargetError("Enter a bare public hostname or IP address.");
  }

  const ipVersion = isIP(target);

  if (ipVersion > 0) {
    if (!isPublicIp(target)) {
      throw new InvalidTargetError("Probe supports only public IP addresses.");
    }

    return {
      input: rawTarget,
      normalizedTarget: target,
      targetKind: "ip",
      hostname: null,
      ip: target
    };
  }

  if (!hostnamePattern.test(target)) {
    throw new InvalidTargetError("Target must be a valid public hostname.");
  }

  return {
    input: rawTarget,
    normalizedTarget: target,
    targetKind: "domain",
    hostname: target,
    ip: null
  };
}

export async function resolvePublicAddresses(hostname: string, timeoutMs: number): Promise<string[]> {
  const [ipv4Records, ipv6Records] = await Promise.allSettled([
    withTimeout(dns.resolve4(hostname), timeoutMs, "DNS A resolution timed out."),
    withTimeout(dns.resolve6(hostname), timeoutMs, "DNS AAAA resolution timed out.")
  ]);

  const candidates = [
    ...(ipv4Records.status === "fulfilled" ? ipv4Records.value : []),
    ...(ipv6Records.status === "fulfilled" ? ipv6Records.value : [])
  ].filter(isPublicIp);

  return Array.from(new Set(candidates));
}

export async function validateAndResolveTarget(rawTarget: string, timeoutMs: number): Promise<ResolvedTarget> {
  const normalized = normalizeTargetInput(rawTarget);

  if (normalized.targetKind === "ip") {
    return {
      input: normalized.input,
      normalizedTarget: normalized.normalizedTarget,
      targetKind: "ip",
      hostname: null,
      ip: normalized.ip,
      resolvedAddresses: [normalized.normalizedTarget],
      primaryAddress: normalized.normalizedTarget
    };
  }

  const resolvedAddresses = await resolvePublicAddresses(normalized.normalizedTarget, timeoutMs);

  if (resolvedAddresses.length === 0) {
    throw new InvalidTargetError(
      "Probe supports only public targets. The hostname did not resolve to a public IP address."
    );
  }

  return {
    input: normalized.input,
    normalizedTarget: normalized.normalizedTarget,
    targetKind: "domain",
    hostname: normalized.normalizedTarget,
    ip: null,
    resolvedAddresses,
    primaryAddress: resolvedAddresses[0] ?? null
  };
}

export function formatHostForUrl(host: string): string {
  return isIP(host) === 6 ? `[${host}]` : host;
}
