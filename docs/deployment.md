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
- TCP probing relies on `cloudflare:sockets`.
- Private targets and Cloudflare IP ranges are intentionally blocked.
- Raw UDP probing is intentionally unsupported in v1.

## Production checklist

- replace placeholder rate-limit namespace values in `apps/api/wrangler.jsonc`
- set the production `TURNSTILE_EXPECTED_HOSTNAME`
- confirm the canonical hosted URL remains `https://probe.kordu.tools`
- verify the build and runtime environment with `bun run build`
