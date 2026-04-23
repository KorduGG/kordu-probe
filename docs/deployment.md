# Deployment And Bindings

Kordu Probe is designed for Cloudflare.

## Required worker secrets

- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_EXPECTED_HOSTNAME`

## Required web env

- `PUBLIC_TURNSTILE_SITE_KEY`
- `SITE_URL`

## Required Cloudflare bindings

- `PROBE_RATE_LIMITER`
- `PROBE_ANALYTICS`

## Deployment notes

- The web app is built statically and served through the Worker.
- Astro sitemap generation is handled by `@astrojs/sitemap`, which emits `sitemap-index.xml` plus one or more numbered sitemap files during build.
- The web bundle now ships `manifest.webmanifest`, `/.well-known/security.txt`, `/security/`, and `/LICENSE` as part of the public trust surface.
- `apps/web/public/_headers` sets `Cache-Control: public, max-age=0, must-revalidate, no-transform` so Cloudflare does not auto-inject Web Analytics, Zaraz, Google Tag Gateway, or similar edge-mutated scripts into the HTML shell behind the repo's strict CSP.
- TCP probing relies on `cloudflare:sockets`.
- Private targets and Cloudflare IP ranges are intentionally blocked.
- Raw UDP probing is intentionally unsupported in v1.

## Production checklist

- replace placeholder rate-limit namespace values in `apps/api/wrangler.jsonc`
- set the production `TURNSTILE_EXPECTED_HOSTNAME`
- confirm the canonical hosted URL remains `https://probe.kordu.tools`
- ensure `PUBLIC_TURNSTILE_SITE_KEY` is present in `apps/web/.env` or injected into the build environment before running `bun run build`
- keep Cloudflare edge HTML auto-injection disabled unless you also expand the committed CSP and verify the new third-party origins intentionally
- verify the build and runtime environment with `bun run build`
