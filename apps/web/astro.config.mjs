import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://probe.kordu.tools",
  output: "static",
  integrations: [mdx()]
});

