# API Discovery

Use this skill when you need the machine-readable Kordu Probe surface.

## Discovery URLs

- `/.well-known/api-catalog`
- `/api/openapi.json`
- `/api/check`
- `/api/probe`
- `/docs/api`
- `/.well-known/agent-skills/index.json`

Start with the API catalog, then read the OpenAPI document for request and response schemas. The primary public endpoint is `POST /api/check`, while `POST /api/probe` remains a TCP compatibility alias.
