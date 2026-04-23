import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const site = (process.env.SITE_URL ?? "https://probe.kordu.tools").replace(/\/$/, "");

// Cloudflare Google Tag Gateway prepends two inline bootstrap scripts to HTML responses,
// and the current GTM container emits one inline Ahrefs bootstrap. Keep these hashes in
// sync with the live tag configuration when the zone-level GTG/GTM setup changes.
const googleTagGatewayScriptHashes = [
  "sha384-7q/O/o1S6Sm8Ntz/RCps5vntgBp+PqqrctVEl/EiPmnFqcFt+NPunZu2sm14EoF6",
  "sha384-jDSvZqij4YzR8i2EDPcRPbVAX9TzCB93XTAdh09iTkJkfrxSgcx62ryPPsfswjaM",
  "sha384-lJT9zxpxhrRn0BMBKIxiPe05CNGHuqSxcwuMDKqMgFQpxlf8ijxzMJRI4hfVOf9p"
];

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  markdown: {
    syntaxHighlight: false
  },
  integrations: [
    mdx(),
    sitemap({
      changefreq: "weekly",
      namespaces: {
        news: false,
        xhtml: false,
        image: false,
        video: false
      }
    })
  ],
  fonts: [
    {
      provider: fontProviders.fontshare(),
      name: "Satoshi",
      cssVariable: "--font-satoshi",
      weights: [500, 700, 900],
      styles: ["normal"]
    },
    {
      provider: fontProviders.google(),
      name: "Plus Jakarta Sans",
      cssVariable: "--font-plus-jakarta-sans",
      weights: [400, 500, 600, 700],
      styles: ["normal"]
    },
    {
      provider: fontProviders.google(),
      name: "IBM Plex Mono",
      cssVariable: "--font-ibm-plex-mono",
      weights: [400, 500],
      styles: ["normal"]
    }
  ],
  security: {
    csp: {
      algorithm: "SHA-384",
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        [
          "connect-src 'self'",
          "https://api.ipify.org",
          "https://challenges.cloudflare.com",
          "https://*.googletagmanager.com",
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.g.doubleclick.net",
          "https://pagead2.googlesyndication.com",
          "https://www.google.com",
          "https://www.google.co.uk",
          "https://*.clarity.ms",
          "https://c.bing.com",
          "https://analytics.ahrefs.com"
        ].join(" "),
        "font-src 'self'",
        "form-action 'self'",
        "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com",
        [
          "img-src 'self' data:",
          "https://*.googletagmanager.com",
          "https://*.google-analytics.com",
          "https://*.g.doubleclick.net",
          "https://www.google.com",
          "https://www.google.co.uk",
          "https://*.clarity.ms",
          "https://c.bing.com",
          "https://analytics.ahrefs.com"
        ].join(" "),
        "manifest-src 'self'",
        "object-src 'none'"
      ],
      scriptDirective: {
        resources: [
          "'self'",
          "https://challenges.cloudflare.com",
          "https://*.googletagmanager.com",
          "https://www.clarity.ms",
          "https://scripts.clarity.ms",
          "https://analytics.ahrefs.com"
        ],
        hashes: googleTagGatewayScriptHashes
      },
      styleDirective: {
        resources: ["'self'"]
      }
    }
  }
});
