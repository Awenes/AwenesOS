# Awenes OS agent guide

Read `.ai/context/product.md`, `.ai/context/architecture.md`, and the relevant task/checkpoint before changing code.
Follow `docs/coding-standards.md` for layering, component design, naming, and validation expectations.

## Engineering rules

- Preserve local-first behavior and Windows support.
- Keep domain and application code independent of Commander, SQLite, and any specific CRM.
- Validate boundary inputs with Zod.
- Record state changes as events; never silently repair history.
- Do not mark a task completed until its external system confirms completion.
- Treat tracker issues as candidates until explicitly claimed.
- Add or update tests for behavior changes.
- Do not add a web dashboard, Docker, telemetry, or paid AI dependency in v0.1.

Run `pnpm check`, `pnpm test`, and `pnpm build` before handing off.
