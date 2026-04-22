# Local Development

## Requirements

- Bun `1.3.12+`
- Cloudflare account if you want to run the Worker against real bindings

## Setup

```bash
bun install
bun run generate:agent-skills
```

Then copy:

- `apps/web/.env.example` to `apps/web/.env`
- `apps/api/.dev.vars.example` to `apps/api/.dev.vars`

The production web build now has an explicit preflight contract:

- `PUBLIC_TURNSTILE_SITE_KEY` must exist in `apps/web/.env`, or already be present in the shell environment
- root `bun run build:web` and `bun run build` will fail before Astro starts if that key is missing
- the preflight loader accepts the UTF-16 `.env` format commonly written by Windows editors

## Daily workflow

Build the static web assets used by the Worker:

```bash
bun run build:web
```

If you want to bypass `apps/web/.env` temporarily for local-only work, export the site key in the
shell before running the build command.

Run the Worker:

```bash
bun run dev:api
```

Optional standalone Astro dev server:

```bash
bun run dev:web
```

One-command local path:

```bash
bun dev
```

## Validation baseline

Run all of these before you call work complete:

```bash
bun run typecheck
bun run lint
bun test
bun run build
```
