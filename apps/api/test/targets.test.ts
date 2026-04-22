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
});
