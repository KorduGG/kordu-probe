import type { APIRoute } from "astro";

function getSiteUrl(site: URL | undefined): string {
  return site?.toString().replace(/\/$/, "") ?? "https://probe.kordu.tools";
}

export const GET: APIRoute = ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-index.xml</loc>
  </sitemap>
</sitemapindex>
`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
};
