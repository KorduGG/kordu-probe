import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const site = (process.env.SITE_URL ?? "https://probe.kordu.tools").replace(/\/$/, "");

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
        "connect-src 'self' https://api.ipify.org",
        "font-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "frame-src 'self' https://challenges.cloudflare.com",
        "img-src 'self' data:",
        "manifest-src 'self'",
        "object-src 'none'"
      ],
      scriptDirective: {
        resources: ["'self'", "https://challenges.cloudflare.com"]
      },
      styleDirective: {
        resources: ["'self'"]
      }
    }
  }
});
