import dns from "node:dns/promises";
import { isIP } from "node:net";

import { withTimeout } from "./timeouts";
import type { IpCheckResult, RdapSummary, ResolvedTarget } from "../types";

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cancel(): void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timeout);
    }
  };
}

function trimString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickEntityName(entity: Record<string, unknown>): string | null {
  const vcardArray = Array.isArray(entity.vcardArray) ? entity.vcardArray : [];
  const cardEntries = Array.isArray(vcardArray[1]) ? vcardArray[1] : [];

  for (const entry of cardEntries) {
    if (Array.isArray(entry) && entry[0] === "fn") {
      return trimString(entry[3]);
    }
  }

  return trimString(entity.handle);
}

function mapRdap(data: Record<string, unknown>): RdapSummary {
  const entities = Array.isArray(data.entities) ? data.entities : [];

  return {
    objectClassName: trimString(data.objectClassName),
    handle: trimString(data.handle),
    name: trimString(data.name),
    country: trimString(data.country),
    parentHandle: trimString(data.parentHandle),
    startAddress: trimString(data.startAddress),
    endAddress: trimString(data.endAddress),
    entities: entities.slice(0, 5).map((entity) => {
      const record = entity as Record<string, unknown>;
      return {
        handle: trimString(record.handle),
        name: pickEntityName(record),
        roles: Array.isArray(record.roles) ? record.roles.filter((role): role is string => typeof role === "string") : []
      };
    })
  };
}

async function fetchRdap(pathname: string, timeoutMs: number): Promise<RdapSummary | null> {
  const timeout = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(`https://rdap.org/${pathname}`, {
      signal: timeout.signal,
      headers: {
        accept: "application/rdap+json, application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload: Record<string, unknown> = await response.json();
    return mapRdap(payload);
  } catch {
    return null;
  } finally {
    timeout.cancel();
  }
}

async function reverseNamesFor(ip: string, timeoutMs: number): Promise<string[]> {
  try {
    return await withTimeout(dns.reverse(ip), timeoutMs, "Reverse DNS lookup timed out.");
  } catch {
    return [];
  }
}

export async function runIpCheck(target: ResolvedTarget, timeoutMs: number): Promise<IpCheckResult> {
  const subject = target.hostname ?? target.primaryAddress ?? target.normalizedTarget;
  const ip = target.targetKind === "ip" ? target.normalizedTarget : target.primaryAddress;
  const ipVersion = ip ? (isIP(ip) === 6 ? "IPv6" : "IPv4") : null;
  const reverseNames = ip ? await reverseNamesFor(ip, timeoutMs) : [];

  const rdapPath =
    target.targetKind === "domain" && target.hostname
      ? `domain/${target.hostname}`
      : ip
        ? `ip/${ip}`
        : null;

  const rdap = rdapPath ? await fetchRdap(rdapPath, timeoutMs) : null;

  return {
    status: "ok",
    subject,
    ip,
    ipVersion,
    reverseNames,
    rdap,
    source: "rdap.org+node:dns"
  };
}
