# Kordu Probe

Kordu Probe is a Cloudflare-native connectivity diagnostics toolkit that tells you whether a port, hostname, or endpoint is reachable from the public internet and gives you the next command to run immediately after.

Live service: [probe.kordu.tools](https://probe.kordu.tools)  
OpenAPI: [probe.kordu.tools/api/openapi.json](https://probe.kordu.tools/api/openapi.json)  
API docs: [probe.kordu.tools/docs/api](https://probe.kordu.tools/docs/api)  
API catalog: [probe.kordu.tools/.well-known/api-catalog](https://probe.kordu.tools/.well-known/api-catalog)

Built and maintained by **KORDU LTD**, a private limited company registered in England and Wales (`Company No. 16836154`).

## Why This Exists

Most connectivity checkers stop at "open" or "closed." Kordu Probe is built to answer the next questions too:

- what exactly was checked
- which public vantage ran the check
- what command should I run locally to confirm it
- whether the problem is TCP reachability, DNS, HTTP, or IP metadata

This repo is intentionally product-first and curated. Outside contributions are welcome, but maintainer review stays strict because the service is security-adjacent and externally reachable.

## What You Get

- Unified connectivity API at `POST /api/check`
- Compatibility TCP probe endpoint at `POST /api/probe`
- Modules for `tcp`, `dns`, `http`, `ip`, and explicit `udp` unsupported handling
- Human-readable explanations plus copyable follow-up commands
- Hosted interactive checker with Turnstile only on browser submissions
- OpenAPI, API catalog, agent-skills metadata, robots rules, and static discovery surfaces
- Static sitemap index, web manifest, security.txt, and public legal/security documents
- Cloudflare-native execution model using Workers plus `cloudflare:sockets`

## Quick API Example

```bash
curl https://probe.kordu.tools/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "target": "example.com",
    "port": 443,
    "modules": ["tcp", "dns", "http", "ip"]
  }'
```

Example response shape:

```json
{
  "target": "example.com",
  "modules": ["tcp", "dns", "http", "ip"],
  "results": {
    "tcp": {
      "status": "open",
      "latencyMs": 18
    }
  }
}
```

## Who It Is For

- operators checking whether a public service is reachable from outside their network
- developers debugging DNS, TLS, or HTTP reachability regressions
- gamers and homelab users confirming port forwarding from the public internet
- automation and agent workflows that need machine-readable connectivity checks

## What It Is Not

- not a stealth scanner or bulk enumeration tool
- not a private-network probe from inside your VPC, LAN, or tunnel
- not proof that an application is healthy just because TCP accepted a socket
- not a raw UDP probe platform in v1

## Repository Layout

- `apps/web` - Astro site, landing pages, docs, guides, robots, sitemap, and discovery metadata
- `apps/api` - Hono API on Cloudflare Workers with TCP, DNS, HTTP, and IP checks
- `packages/shared` - shared schemas, port metadata, and OpenAPI contract
- `docs/` - maintainer and contributor docs for local development, deployment, and repo operations

## Quickstart

Requirements:

- Bun `1.3.12+`
- Cloudflare account for deployment

Install:

```bash
bun install
```

Local setup:

1. Copy `apps/web/.env.example` to `apps/web/.env`
2. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`
3. Generate the agent-skills index with `bun run generate:agent-skills`
4. Build the web app with `bun run build:web`
5. Start the Worker with `bun run dev:api`

Useful commands:

```bash
bun run typecheck
bun run lint
bun test
bun run build
```

`bun run build` now uses the root preflight script for the Astro site. If `PUBLIC_TURNSTILE_SITE_KEY`
is missing from `apps/web/.env` and not already present in the shell environment, the build fails
immediately with a clear error before Astro prerendering starts.

If you want the full local flow:

```bash
bun dev
```

More setup detail:

- [Local development](./docs/local-development.md)
- [Deployment and Cloudflare bindings](./docs/deployment.md)
- [Maintainer operations and public launch checklist](./docs/maintainer-operations.md)

## Environment And Bindings

Worker secrets:

- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_EXPECTED_HOSTNAME`

Web build env:

- `PUBLIC_TURNSTILE_SITE_KEY`
- `SITE_URL`

Public trust surfaces shipped by the web app:

- `/.well-known/security.txt`
- `/SECURITY`
- `/LICENSE`
- `/manifest.webmanifest`

Cloudflare bindings:

- `PROBE_RATE_LIMITER`
- `PROBE_ANALYTICS`

The starter `wrangler.jsonc` uses a placeholder namespace ID for rate limiting. Replace it before production deployment.

## Runtime Constraints

- only public targets are supported
- private IP ranges and Cloudflare IP ranges are blocked
- port `25` is blocked
- raw UDP probing is intentionally unsupported in v1
- a successful TCP probe does not prove full application health

## Project Status

Kordu Probe is pre-`1.0.0`.

- the public API is usable, but the project should still be treated as evolving
- maintainers may reject features that add operational or abuse risk
- larger behavior changes should be discussed before implementation

## About Kordu

Kordu Probe is part of the broader Kordu product family.

- company: `KORDU LTD`
- jurisdiction: England and Wales
- company number: `16836154`
- registered office: `First Floor Office, 3 Hornton Place, London, United Kingdom, W8 4LZ`
- main public surfaces today: `probe.kordu.tools`, `kordu.tools`, `kordu.gg`

For day-to-day product usage, prefer the hosted documentation and service links above. The registered office is included here for legal transparency, not as a support address.

## Open Source Boundaries

The code in this repository is licensed under [Apache-2.0](./LICENSE).

That means people may use, modify, and redistribute the code, including commercially, as long as they comply with the license terms. The project stays curated through review policy and brand control, not through source restrictions.

Important boundaries:

- code: Apache-2.0
- names, logos, and official hosted identity: not licensed under Apache-2.0
- trademark and brand rules: [TRADEMARKS.md](./TRADEMARKS.md)

## Contributing And Security

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
