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

## Daily workflow

Build the static web assets used by the Worker:

```bash
bun run build:web
```

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
