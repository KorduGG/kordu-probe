import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(webRoot, "dist");

describe("web build outputs", () => {
  it("ships robots.txt with explicit AI bot rules and content signals", () => {
    const robots = readFileSync(path.join(distRoot, "robots.txt"), "utf8");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Content-Signal: ai-train=no, search=yes, ai-input=yes");
    expect(robots).toContain("Sitemap: https://probe.kordu.tools/sitemap.xml");
  });

  it("ships a sitemap rooted at /sitemap.xml", () => {
    const sitemap = readFileSync(path.join(distRoot, "sitemap.xml"), "utf8");
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("https://probe.kordu.tools/port-checker");
    expect(sitemap).toContain("https://probe.kordu.tools/ports/25565");
  });

  it("ships the homepage with initial HTML value and Turnstile markup", () => {
    const indexHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
    expect(indexHtml).toContain("Check any port");
    expect(indexHtml).toContain("probe-turnstile-container");
    expect(indexHtml).toContain("API Catalog");
    expect(indexHtml).toContain("Open the dedicated checker page to verify and run the live request.");
    expect(indexHtml).toContain("Start on the full checker");
    expect(indexHtml).toContain("Start checking");
    expect(indexHtml).not.toContain("Turnstile-gated website checks run through the unified connectivity API.");
  });

  it("keeps homepage discovery Link headers in the static headers file", () => {
    const headers = readFileSync(path.join(webRoot, "public", "_headers"), "utf8");
    expect(headers).toContain('rel="api-catalog"');
    expect(headers).toContain('rel="service-desc"');
    expect(headers).toContain('rel="service-doc"');
    expect(headers).toContain('rel="describedby"');
  });

  it("publishes the generated agent skills index", () => {
    const skillsIndex = readFileSync(
      path.join(distRoot, ".well-known", "agent-skills", "index.json"),
      "utf8"
    );
    expect(skillsIndex).toContain('"$schema"');
    expect(skillsIndex).toContain('"tcp-probe"');
    expect(skillsIndex).toContain('/api/check');
    expect(skillsIndex).toContain('"digest"');
  });
});
