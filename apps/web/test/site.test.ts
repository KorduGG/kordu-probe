import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(webRoot, "dist");

function getHeaderBlocks(headers: string) {
  return headers
    .trim()
    .split(/\r?\n\r?\n/u)
    .map((block) => block.split(/\r?\n/u).map((line) => line.trim()))
    .filter((lines) => lines.length > 0);
}

function getHeaderBlock(blocks: string[][], route: string) {
  return blocks.find((lines) => lines[0] === route);
}

describe("web build outputs", () => {
  it("ships robots.txt with explicit AI bot rules and content signals", () => {
    const robots = readFileSync(path.join(distRoot, "robots.txt"), "utf8");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Content-Signal: ai-train=no, search=yes, ai-input=yes");
    expect(robots).toContain("Sitemap: https://probe.kordu.tools/sitemap-index.xml");
  });

  it("ships the Astro sitemap index and content sitemap", () => {
    const sitemapIndex = readFileSync(path.join(distRoot, "sitemap-index.xml"), "utf8");
    const sitemap = readFileSync(path.join(distRoot, "sitemap-0.xml"), "utf8");
    expect(sitemapIndex).toContain("<sitemapindex");
    expect(sitemapIndex).toContain("https://probe.kordu.tools/sitemap-0.xml");
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("https://probe.kordu.tools/port-checker/");
    expect(sitemap).toContain("https://probe.kordu.tools/guides/");
    expect(sitemap).toContain("https://probe.kordu.tools/ports/25565/");
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

  it("ships the homepage with hardened metadata and Astro-managed fonts", () => {
    const indexHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
    expect(indexHtml).toContain('<meta name="theme-color" content="#0a0a0a">');
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(indexHtml).toContain('<link rel="sitemap" href="/sitemap-index.xml">');
    expect(indexHtml).not.toContain("fonts.googleapis.com");
    expect(indexHtml).not.toContain("api.fontshare.com");
  });

  it("keeps the generated CSP compatible with the Turnstile loader and IP helper", () => {
    const indexHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
    expect(indexHtml).toContain("connect-src 'self' https://api.ipify.org https://challenges.cloudflare.com");
    expect(indexHtml).not.toContain("'strict-dynamic'");
    expect(indexHtml).not.toContain("frame-ancestors");
  });

  it("keeps the generated CSP compatible with the live Google Tag Gateway stack", () => {
    const indexHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
    expect(indexHtml).toContain(
      "script-src 'self' https://challenges.cloudflare.com https://*.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms https://analytics.ahrefs.com"
    );
    expect(indexHtml).toContain("https://*.googletagmanager.com");
    expect(indexHtml).toContain("https://*.google-analytics.com");
    expect(indexHtml).toContain("https://*.analytics.google.com");
    expect(indexHtml).toContain("https://*.g.doubleclick.net");
    expect(indexHtml).toContain("https://pagead2.googlesyndication.com");
    expect(indexHtml).toContain("https://www.google.com");
    expect(indexHtml).toContain("https://www.google.co.uk");
    expect(indexHtml).toContain("https://www.clarity.ms");
    expect(indexHtml).toContain("https://*.clarity.ms");
    expect(indexHtml).toContain("https://c.bing.com");
    expect(indexHtml).toContain("https://analytics.ahrefs.com");
    expect(indexHtml).toContain("sha384-7q/O/o1S6Sm8Ntz/RCps5vntgBp+PqqrctVEl/EiPmnFqcFt+NPunZu2sm14EoF6");
    expect(indexHtml).toContain("sha384-jDSvZqij4YzR8i2EDPcRPbVAX9TzCB93XTAdh09iTkJkfrxSgcx62ryPPsfswjaM");
    expect(indexHtml).toContain("sha384-lJT9zxpxhrRn0BMBKIxiPe05CNGHuqSxcwuMDKqMgFQpxlf8ijxzMJRI4hfVOf9p");
  });

  it("ships the probe form runtime as a same-origin asset instead of brittle inline JS", () => {
    const indexHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
    expect(indexHtml).not.toContain('const form = document.getElementById("probe-form");');
    const runtimeScript = indexHtml.match(/<script type="module" src="(\/_astro\/[^"]+)"><\/script>/);
    expect(runtimeScript?.[1]).toBeDefined();

    const runtimeAsset = readFileSync(path.join(distRoot, runtimeScript![1].slice(1)), "utf8");
    expect(runtimeAsset).toContain("net.JoinHostPort");
    expect(runtimeAsset).not.toContain("while(!tokenInput.value");
    expect(runtimeAsset).not.toContain("while (!tokenInput.value");
  });

  it("keeps homepage discovery and security headers in the static headers file", () => {
    const headers = readFileSync(path.join(webRoot, "public", "_headers"), "utf8");
    const blocks = getHeaderBlocks(headers);
    const globalBlock = getHeaderBlock(blocks, "/*");
    const rootBlock = getHeaderBlock(blocks, "/");
    const astroAssetBlock = getHeaderBlock(blocks, "/_astro/*");

    expect(headers).toContain('rel="api-catalog"');
    expect(headers).toContain('rel="service-desc"');
    expect(headers).toContain('rel="service-doc"');
    expect(headers).toContain('rel="describedby"');
    expect(globalBlock).toBeDefined();
    expect(globalBlock?.join("\n")).toContain("X-Frame-Options: DENY");
    expect(globalBlock?.join("\n")).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    expect(globalBlock?.join("\n")).toContain("Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()");
    expect(globalBlock?.join("\n")).toContain("Cache-Control: public, max-age=0, must-revalidate, no-transform");
    expect(rootBlock?.join("\n")).toContain('rel="api-catalog"');
    expect(rootBlock?.join("\n")).toContain('rel="service-desc"');
    expect(rootBlock?.join("\n")).toContain('rel="service-doc"');
    expect(rootBlock?.join("\n")).toContain('rel="describedby"');
    expect(astroAssetBlock?.join("\n")).toContain("! Cache-Control");
    expect(astroAssetBlock?.join("\n")).toContain("Cache-Control: public, max-age=31556952, immutable");
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

  it("publishes a legacy /sitemap.xml compatibility entrypoint", () => {
    const legacySitemap = readFileSync(path.join(distRoot, "sitemap.xml"), "utf8");
    expect(legacySitemap).toContain("<sitemapindex");
    expect(legacySitemap).toContain("https://probe.kordu.tools/sitemap-index.xml");
  });

  it("publishes the public trust surfaces", () => {
    const manifest = readFileSync(path.join(distRoot, "manifest.webmanifest"), "utf8");
    const securityTxt = readFileSync(path.join(distRoot, ".well-known", "security.txt"), "utf8");
    const securityPage = readFileSync(path.join(distRoot, "security", "index.html"), "utf8");
    expect(manifest).toContain('"name":"Kordu Probe"');
    expect(manifest).toContain('"id":"/"');
    expect(manifest).toContain('"start_url":"/"');
    expect(manifest).toContain('"display":"standalone"');
    expect(manifest).toContain('"purpose":"any maskable"');
    expect(securityTxt).toContain("Contact: mailto:iyda@kordu.gg");
    expect(securityTxt).toContain("Policy: https://probe.kordu.tools/security/");
    expect(securityPage).toContain("Security policy and disclosure path.");
    expect(securityPage).toContain("GitHub private vulnerability reporting");
  });

  it("builds guide and port listing pages for navigation instead of pointing at arbitrary detail pages", () => {
    const guidesIndex = readFileSync(path.join(distRoot, "guides", "index.html"), "utf8");
    const portsIndex = readFileSync(path.join(distRoot, "ports", "index.html"), "utf8");
    expect(guidesIndex).toContain("Connectivity guides");
    expect(guidesIndex).toContain("/guides/how-to-port-forward-minecraft/");
    expect(portsIndex).toContain("Popular ports and service references");
    expect(portsIndex).toContain("/ports/443/");
  });

  it("renders guide pages with listing breadcrumbs and article metadata", () => {
    const guideHtml = readFileSync(
      path.join(distRoot, "guides", "how-to-port-forward-minecraft", "index.html"),
      "utf8"
    );
    expect(guideHtml).toContain('"@type":"Article"');
    expect(guideHtml).toContain("/guides/");
    expect(guideHtml).toContain("Published");
  });
});
