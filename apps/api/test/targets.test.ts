import { describe, expect, it } from "vitest";

import { isPublicIp, normalizeTargetInput } from "../src/lib/targets";

describe("target validation", () => {
  it("rejects IPv4-mapped loopback IPv6 targets as non-public", () => {
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(() => normalizeTargetInput("::ffff:127.0.0.1")).toThrow("public IP addresses");
  });

  it("rejects IPv4-mapped private IPv6 targets as non-public", () => {
    expect(isPublicIp("::ffff:10.0.0.1")).toBe(false);
    expect(() => normalizeTargetInput("::ffff:10.0.0.1")).toThrow("public IP addresses");
  });

  it("rejects IANA special-purpose IPv6 ranges as non-public", () => {
    const blockedAddresses = [
      "::",
      "::1",
      "::ffff:93.184.216.34",
      "64:ff9b::c000:201",
      "64:ff9b:1::1",
      "100::1",
      "2001::1",
      "2001:2::1",
      "2001:db8::1",
      "2002::1",
      "3fff::1",
      "5f00::1",
      "fc00::1",
      "fd00::1",
      "fe80::1",
      "ff02::1"
    ];

    for (const address of blockedAddresses) {
      expect(isPublicIp(address), address).toBe(false);
      expect(() => normalizeTargetInput(address), address).toThrow("public IP addresses");
    }
  });

  it("allows globally reachable IPv6 addresses", () => {
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
    expect(normalizeTargetInput("2606:4700:4700::1111").targetKind).toBe("ip");
  });
});
