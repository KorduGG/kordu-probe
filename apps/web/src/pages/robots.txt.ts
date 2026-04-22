import type { APIRoute } from "astro";

function getSiteUrl(site: URL | undefined): string {
  return site?.toString().replace(/\/$/, "") ?? "https://probe.kordu.tools";
}

export const GET: APIRoute = ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const robots = `User-agent: GPTBot
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: OAI-SearchBot
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: Claude-Web
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: Google-Extended
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: Amazonbot
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: anthropic-ai
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: Bytespider
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: CCBot
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: Applebot-Extended
Allow: /
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(robots, {
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
};
