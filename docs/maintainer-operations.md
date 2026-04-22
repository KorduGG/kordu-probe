# Maintainer Operations

This repo is intended to be a curated public project, not an unreviewed contribution funnel.

## Legal identity

- operating company: `KORDU LTD`
- company number: `16836154`
- registered office: `First Floor Office, 3 Hornton Place, London, United Kingdom, W8 4LZ`

Keep this information consistent across the README, legal pages, and any public footer or imprint.

## Launch gate

Do not call the repo launch-ready unless all of these are true:

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- `bun run build` passes
- README, license, security, contributing, code of conduct, issue templates, and PR template are present and current

## GitHub settings to apply before public launch

These settings live in GitHub, not in the repo. Apply them once the repository has a real remote:

- protect `main` with a ruleset
- require pull requests before merge
- require passing CI
- require at least one maintainer review
- require code owner review
- disable force pushes to `main`
- enable secret scanning and push protection
- enable Dependabot alerts
- enable CodeQL default setup for the repository
- enable private vulnerability reporting
- enable GitHub Discussions if you want community Q&A separated from issues

## Review policy

- prefer narrow pull requests
- require docs updates when public behavior changes
- reject features that materially expand abuse surface or operational complexity without a strong case
- keep official brand usage under the trademark policy even though the code is open source
