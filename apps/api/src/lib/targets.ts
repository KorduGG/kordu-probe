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

function ipv4ToHextets(ip: string): [string, string] | null {
  const parts = ip.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const bytes = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
  });

  if (bytes.some((byte) => byte === null)) {
    return null;
  }

  const [first, second, third, fourth] = bytes as [number, number, number, number];
  return [
    ((first << 8) | second).toString(16),
    ((third << 8) | fourth).toString(16)
  ];
}

function parseIpv6ToBigInt(ip: string): bigint | null {
  let normalized = ip.toLowerCase();

  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4 = normalized.slice(lastColon + 1);
    const hextets = ipv4ToHextets(ipv4);

    if (lastColon === -1 || !hextets) {
      return null;
    }

    normalized = `${normalized.slice(0, lastColon)}:${hextets[0]}:${hextets[1]}`;
  }

  const compressedParts = normalized.split("::");

  if (compressedParts.length > 2) {
    return null;
  }

  const left = compressedParts[0] ? compressedParts[0].split(":") : [];
  const right = compressedParts[1] ? compressedParts[1].split(":") : [];
  const missing = 8 - left.length - right.length;

  if ((compressedParts.length === 1 && missing !== 0) || (compressedParts.length === 2 && missing < 1)) {
    return null;
  }

  const hextets = [
    ...left,
    ...Array<string>(Math.max(missing, 0)).fill("0"),
    ...right
  ];

  if (hextets.length !== 8) {
    return null;
  }

  return hextets.reduce<bigint>((value, part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) {
      return -1n;
    }

    return (value << 16n) + BigInt(parseInt(part, 16));
  }, 0n);
}

function isIpv6InRange(ip: string, base: string, maskBits: number): boolean {
  const ipValue = parseIpv6ToBigInt(ip);
  const baseValue = parseIpv6ToBigInt(base);

  if (ipValue === null || baseValue === null || ipValue < 0n || baseValue < 0n) {
    return true;
  }

  if (maskBits === 0) {
    return true;
  }

  const shift = BigInt(128 - maskBits);
  return (ipValue >> shift) === (baseValue >> shift);
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
  const blockedRanges = [
    ["::", 96],
    ["::1", 128],
    ["::ffff:0:0", 96],
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 23],
    ["2001:2::", 48],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20],
    ["5f00::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8]
  ] as const;

  return !blockedRanges.some(([base, bits]) => isIpv6InRange(ip, base, bits));
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
