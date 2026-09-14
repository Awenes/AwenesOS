# Workflow and UX overhaul

Status: awaiting visual QA

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

Checkpoints 1–5 are implemented, along with the checkpoint 6 archive, provider-removal, custom-agent, dashboard, and friendly-export capabilities. Guided onboarding can initialize Git only after explicit consent. One-action task launch uses automatic orchestration, balanced and guided runs pause on readable plans, and the task cockpit presents stages and interventions. Automated validation is green; visual QA is required before final resilience, accessibility, and Windows acceptance testing.
