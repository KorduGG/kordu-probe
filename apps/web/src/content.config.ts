import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const guides = defineCollection({
  loader: glob({ pattern: "**/*.(md|mdx)", base: "./src/content/guides" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.string()
  })
});

const ports = defineCollection({
  loader: glob({ pattern: "**/*.(md|mdx)", base: "./src/content/ports" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    port: z.number().int().positive(),
    service: z.string()
  })
});

export const collections = { guides, ports };
