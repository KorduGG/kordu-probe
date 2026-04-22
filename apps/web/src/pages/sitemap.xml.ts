import { getCollection, type CollectionEntry } from "astro:content";
import type { APIRoute } from "astro";

const staticRoutes = ["/", "/port-checker", "/tools/tcp-port-checker", "/docs/api"] as const;

export const GET: APIRoute = async ({ site }) => {
  const [ports, guides] = await Promise.all([getCollection("ports"), getCollection("guides")]);

  const urls = [
    ...staticRoutes,
    ...ports.flatMap((entry: CollectionEntry<"ports">) => [
      `/ports/${entry.data.port}`,
      `/check-port-${entry.data.port}`
    ]),
    ...guides.map((entry: CollectionEntry<"guides">) => `/guides/${entry.id}`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${new URL(path, site).toString()}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
};
