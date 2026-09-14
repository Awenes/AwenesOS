# Workflow and UX overhaul

Status: awaiting final user acceptance

Rebuild AwenesOS around the developer journey: add a project, start a task, intervene only when needed, review evidence, approve delivery, and confirm external updates.

## Product invariants

- A task says **Working** only while a real step is executing.
- Pending work is **Preparing**; blocked work states the exact intervention required.
- Balanced autonomy is the default. Git push always requires explicit approval in v0.1.
- A folder without Git may be initialized only after explicit developer confirmation.
- Plans requiring approval are readable and revisable inside the app.
- Archive is reversible. Permanent deletion is separately confirmed and never deletes the normal repository or an external record.
- Exports exclude credentials and provider tokens.
- Existing prompts, skills, events, evidence, and workflow snapshots remain immutable history.

## Checkpoints

1. Domain and persistence: autonomy, acceptance criteria, plans, interventions, lifecycle, leases, and user-facing state derivation.
2. Dark design system: semantic feedback, loading patterns, accessible interactive states, and responsive desktop layout.
3. Guided project onboarding: folder selection, Git initialization offer, readiness, provider, defaults, permissions, and operating mode.
4. One-action task launch with atomic preflight and durable automatic orchestration.
5. Task cockpit, plan approval, intervention handling, live activity, review, and revision cycles.
6. Delivery, archive/delete, dashboard/history, custom agents, provider removal, and friendly exports.
7. Migration verification, Windows E2E, resilience, accessibility, and acceptance testing.

## Current checkpoint

Checkpoints 1–7 are implemented. The renderer now uses shared components, hooks, presentation utilities, and consistent pagination. Keyboard navigation includes a skip link, current-page semantics, alert announcements, visible focus, and reduced-motion support. The automated Windows Electron smoke test launches against an isolated database and verifies a rendered PNG. Type checks, unit/integration tests, production build, and desktop smoke test are green. Final user acceptance remains.
