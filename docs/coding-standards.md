# AwenesOS coding standards

These standards keep AwenesOS understandable as the product grows. They apply to new code and to code touched during maintenance.

## Core principles

### Keep it simple (KISS)

- Prefer a small, explicit function over a configurable abstraction.
- Use the product vocabulary from the domain instead of generic framework terms.
- Keep control flow shallow with guard clauses.
- Do not introduce a library when the platform or a short local implementation is sufficient.
- Optimize for the next engineer reading the code, not the fewest lines.

### Avoid repetition (DRY)

- Keep business rules in one domain or application function.
- Reuse visual primitives for repeated interaction patterns such as panels, badges, empty states, pagination, loading, and feedback.
- Extract repeated logic after the second real use, when the shared concept is clear.
- Do not combine code merely because it looks similar; share behavior only when it changes for the same reason.

### Separate concerns

- `domain`: schemas, vocabulary, state rules, and pure calculations. No Electron, React, SQLite, Commander, or provider imports.
- `application`: use cases and orchestration through ports. No UI formatting or database queries.
- `infrastructure`: implementations for persistence, Git, processes, providers, browser automation, and external systems.
- `desktop/main`: validated IPC composition only. Delegate behavior to application services.
- `desktop/renderer`: presentation and user interaction only. Access capabilities through the typed desktop bridge.

Dependencies point inward: `desktop/CLI → application → domain`. Infrastructure implements ports defined by the inner layers.

## React structure

- Screens compose features; shared components render one reusable interaction pattern.
- Hooks own reusable stateful behavior and side effects.
- Utilities are pure and deterministic.
- Components receive the smallest useful props and do not reach into persistence or Node APIs.
- Keep asynchronous actions close to the feature that owns them, with global activity and feedback handled centrally.
- Prefer derived values over duplicated state.
- Reset pagination and selection when their filtering context changes.

Use these practical size signals:

- Around 150 lines: consider extracting a cohesive component or hook.
- Around 300 lines: splitting is normally required unless the file is declarative data.
- A component with multiple unrelated forms or workflows must be separated regardless of length.

These are design signals, not incentives to create meaningless wrapper files.

## Functions and types

- Validate every external boundary with Zod.
- Prefer explicit input and result types at application and infrastructure boundaries.
- Keep pure transformations separate from side effects.
- Use names that describe intent: `requestPlanApproval`, not `handleThing`.
- Avoid `any`. When external data is temporarily unknown, narrow it before use.
- Return early on invalid states and make error messages actionable.

## State and persistence

- Record meaningful state changes as immutable events.
- Never silently repair workflow history.
- Use migrations for every persisted schema change.
- Archive is reversible; deletion retains the minimal audit tombstone.
- Credentials and provider tokens must never enter exports, events, logs, or renderer snapshots.

## Testing and delivery

- Pure domain rules get focused unit tests.
- Application behavior gets service-level tests with replaceable ports.
- Infrastructure that invokes Git, browsers, or processes gets bounded integration tests.
- Every bug fix should add a regression test where practical.
- Before handoff, run `pnpm check`, `pnpm test`, and `pnpm build` (or the equivalent npm scripts in environments where pnpm is unavailable).
- Commit one coherent, validated change at a time.

## Review checklist

- Is the rule implemented in the correct layer?
- Does an existing component, hook, or utility already express this concept?
- Is the abstraction simpler than the duplication it replaces?
- Are loading, success, failure, empty, and disabled states represented?
- Are permission boundaries and external mutations explicit?
- Are tests focused on behavior rather than implementation details?
