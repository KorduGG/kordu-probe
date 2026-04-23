import { describe, expect, it } from "vitest";

import { getRequestedModulesForTargetKind } from "../src/lib/modules";

describe("default module selection", () => {
  it("defaults port checks to tcp only", () => {
    expect(getRequestedModulesForTargetKind({ target: "example.com", port: 443 }, "domain")).toEqual(["tcp"]);
  });

  it("defaults explicit HTTP hints to http only", () => {
    expect(
      getRequestedModulesForTargetKind({ target: "example.com", port: 443, http: { scheme: "https" } }, "domain")
    ).toEqual(["http"]);
  });

  it("keeps DNS and IP metadata explicit or no-port only", () => {
    expect(getRequestedModulesForTargetKind({ target: "example.com" }, "domain")).toEqual(["dns"]);
    expect(getRequestedModulesForTargetKind({ target: "93.184.216.34" }, "ip")).toEqual(["ip"]);
    expect(
      getRequestedModulesForTargetKind({ target: "example.com", modules: ["tcp", "dns", "http", "ip"] }, "domain")
    ).toEqual(["tcp", "dns", "http", "ip"]);
  });
});
