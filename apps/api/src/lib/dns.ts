import dns from "node:dns/promises";

import { withTimeout } from "./timeouts";
import type { DnsCheckResult, DnsRecordMap, ResolvedTarget } from "../types";

export function emptyRecords(): DnsRecordMap {
  return {
    a: [],
    aaaa: [],
    cname: [],
    mx: [],
    ns: [],
    txt: []
  };
}

export async function runDnsCheck(target: ResolvedTarget, timeoutMs: number): Promise<DnsCheckResult> {
  const records = emptyRecords();
  let reverseNames: string[] = [];

  if (target.targetKind === "domain" && target.hostname) {
    const [a, aaaa, cname, mx, ns, txt] = await Promise.allSettled([
      withTimeout(dns.resolve4(target.hostname), timeoutMs, "DNS A lookup timed out."),
      withTimeout(dns.resolve6(target.hostname), timeoutMs, "DNS AAAA lookup timed out."),
      withTimeout(dns.resolveCname(target.hostname), timeoutMs, "DNS CNAME lookup timed out."),
      withTimeout(dns.resolveMx(target.hostname), timeoutMs, "DNS MX lookup timed out."),
      withTimeout(dns.resolveNs(target.hostname), timeoutMs, "DNS NS lookup timed out."),
      withTimeout(dns.resolveTxt(target.hostname), timeoutMs, "DNS TXT lookup timed out.")
    ]);

    if (a.status === "fulfilled") records.a = a.value;
    if (aaaa.status === "fulfilled") records.aaaa = aaaa.value;
    if (cname.status === "fulfilled") records.cname = cname.value;
    if (mx.status === "fulfilled") {
      records.mx = mx.value.map((entry) => ({
        exchange: entry.exchange,
        priority: entry.priority
      }));
    }
    if (ns.status === "fulfilled") records.ns = ns.value;
    if (txt.status === "fulfilled") records.txt = txt.value.map((chunk) => chunk.join(""));
  }

  const reverseTargets =
    target.targetKind === "ip"
      ? [target.normalizedTarget]
      : target.resolvedAddresses.slice(0, 3);

  if (reverseTargets.length > 0) {
    const lookups = await Promise.allSettled(
      reverseTargets.map((ip) => withTimeout(dns.reverse(ip), timeoutMs, "Reverse DNS lookup timed out."))
    );
    reverseNames = Array.from(
      new Set(
        lookups.flatMap((lookup) => (lookup.status === "fulfilled" ? lookup.value : []))
      )
    );
  }

  return {
    status: "ok",
    resolver: "node:dns",
    hostname: target.hostname,
    reverseNames,
    records
  };
}
