# Repository Guidelines

## Project Structure & Module Organization

Kordu Probe is a Bun monorepo.

- `apps/api/src` contains the Hono Cloudflare Worker for TCP, DNS, HTTP, and IP checks.
- `apps/api/test` contains Vitest coverage for request handling, target validation, and timeout behavior.
- `apps/web/src` contains the Astro site, MDX content, pages, and shared UI.
- `apps/web/test` contains site and build-contract tests.
- `packages/shared/src` is the source of truth for shared schemas, OpenAPI, agent-skills metadata, and port data.
- `docs/` holds maintainer and deployment docs; `scripts/` holds root build helpers.

## Build, Test, and Development Commands

Use Bun only; `scripts/enforce-bun.mjs` blocks other package managers.

- `bun install` installs workspace dependencies.
- `bun run dev:web` starts the Astro app from `apps/web`.
- `bun run dev:api` starts Wrangler for the Worker in `apps/api`.
- `bun run typecheck` runs shared, web, and API type checks.
- `bun run lint` lints `apps/api`, `packages/shared`, and `scripts`.
- `bun test` regenerates agent skills and runs all Vitest suites.
- `bun run build` regenerates agent skills and validates the production build.

If you change discovery metadata, rerun `bun run generate:agent-skills`.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, LF, 2-space indentation. Use TypeScript ESM throughout. Keep shared contracts in `packages/shared` instead of duplicating types or constants. Use PascalCase for Astro components, lowercase or descriptive names for route and library files, and `*.test.ts` for tests. ESLint 9 plus `typescript-eslint` is the enforced baseline.

## Testing Guidelines

Add or update tests for every behavior change, especially target validation, rate limiting, HTTP probing, and build-time content guarantees. Keep API tests under `apps/api/test` and web tests under `apps/web/test`. Run `bun test` before finishing and `bun run build` when generated pages, env handling, or discovery files change.

## Commit & Pull Request Guidelines

Use conventional commits with scope, for example `feat(web): add port guide` or `fix(api): tighten target parsing`. Keep PRs narrow, include local validation results, and update docs when public behavior changes. For larger or abuse-sensitive changes, align with maintainers first. Never commit secrets, `.env`, or `.dev.vars`.

## Security & Configuration Tips

This repo is a public diagnostics surface. Do not weaken target validation, rate limiting, Turnstile checks, or blocked-network guardrails as part of unrelated work. If you change discovery metadata, docs, or public API behavior, update the matching files in the same change.

## Workspace Coordination

Multiple agents may work in this workspace at the same time. Never revert or overwrite changes you did not make unless the task explicitly requires it.
