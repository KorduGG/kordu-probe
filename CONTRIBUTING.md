# Contributing to Kordu Probe

Thanks for contributing. This project is open source, but it is intentionally curated.

We want outside help. We do not merge work casually. Kordu Probe is a public diagnostics surface, so maintainers will optimize for operational safety, abuse resistance, and long-term maintainability over feature volume.

## Before you start

- Use **Bun** for dependency installation and script execution.
- Do not commit secrets, `.env`, or `.dev.vars` files.
- Keep changes focused. If you are fixing a bug, avoid mixing unrelated refactors into the same pull request.
- Review the docs in [`docs/`](./docs/) if your change touches local setup, deployment, or repo operations.
- Do not use the Kordu or Kordu Probe names, logos, or hosted identity for your own fork without following [TRADEMARKS.md](./TRADEMARKS.md).

## Local setup

1. Install Bun.
2. Run `bun install`.
3. Copy `apps/web/.env.example` to `apps/web/.env`.
4. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`.

## Day-to-day commands

- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun dev`

If you only need one surface:

- `bun run dev:web`
- `bun run dev:api`

## Contribution model

- Small, well-scoped fixes are the easiest path to merge.
- For larger changes, behavior changes, new modules, abuse-sensitive features, or any product-direction change, open an issue first and align with maintainers before writing code.
- If maintainers redirect the idea, that is expected. "Technically works" is not by itself enough for merge.

## Pull requests

- Write a clear title and description.
- Include validation steps and the results you ran locally.
- If your change affects public behavior, update docs or content in the same PR.
- If your change affects discovery metadata, regenerate it with `bun run generate:agent-skills`.
- Keep PRs reviewable. Split unrelated work.
- Expect maintainers to ask for narrower scope, additional tests, or different interfaces even if the implementation is correct.

## Required validation

Run the full baseline before opening a PR:

- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

If a command fails because of unrelated baseline debt, call that out explicitly in the PR. Do not silently omit it.

## Commit format

Use conventional commits where practical:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `chore:`

## Security

If you find a security issue, do **not** open a public issue with exploit details.
Follow the instructions in [SECURITY.md](./SECURITY.md).
