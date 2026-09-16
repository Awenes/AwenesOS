# Codebase cleanup and smoother desktop setup

Status: implementation complete; awaiting developer acceptance test

Remove the obsolete CRM and CSV tracker-import workflows, make the desktop language clearer, replace sidebar text glyphs with SVG icons, and turn localhost browser-test setup into a detect-and-confirm flow. See `.ai/decisions/0003-retire-crm-and-tracker-integrations.md`.

## Delivery checkpoints

1. Legacy removal: CRM coordination and CSV tracker-import CLI commands, application services, adapters, tests, and how-to docs removed. Migrations, historical database tables, and the `NotificationKind`/task-source enum values that describe past CRM/tracker events stay in place so existing local databases and event history remain readable.
2. Desktop decomposition: `App.tsx` replaced by `desktop-app.tsx` as a thin shell; `Overview`, `Projects`, `Tasks`, `Approvals`, `Notifications`, `Agents`, `Providers`, `Safety`, and `Runs` each live in their own kebab-case component file alongside the previously extracted `app-sidebar.tsx`, `navigation-icon.tsx`, and `browser-test-setup.tsx`.
3. Plain-language workflow copy: `src/domain/workflow-messages.ts` centralizes per-stage labels ("Creating a plan," "Making changes," "Checking the changes," "Preparing delivery"); "Checking project setup…" covers browser-setup detection. Technical failure detail stays behind an expandable "Technical details" disclosure rather than as the primary message.
4. Sidebar icons: `navigation-icon.tsx` renders one consistent stroke-style SVG per nav item; labels, `aria-current`, and collapsed-sidebar `title`/`aria-label` tooltips are preserved.
5. Browser-test setup suggestion: `local-browser-setup-detector.ts` reads a project's `package.json` and known Chrome/Edge install locations without executing anything, and returns a `BrowserSetupSuggestion` (command, args, base/health URL, browser path, warnings). The `awenes:browser:suggest` bridge channel is read-only and Zod-validated; `awenes:browser:config` requires an explicit `confirmLocalhostAccess: true` alongside the validated `BrowserTestConfig` before saving. The renderer form shows a command/URL preview and a permission checkbox, and every field stays editable for non-Node or ambiguous projects.
6. Documentation: README, `docs/architecture.md`, `docs/desktop-preview.md`, `docs/cli.md`, and `docs/qa-testing-guide.md` describe the current desktop workflow, excluded integrations, and the setup-suggestion flow; no stale tracker/CRM references or build-statistic claims remain.

## Verification

`pnpm check`, `pnpm test`, `pnpm build`, and `pnpm test:desktop-smoke` are green. Manual verification of the setup-suggestion flow and narrow-window layouts is covered by the automated `renderer-responsive` Playwright test (sidebar collapse, 380px/960px widths, "Suggest setup from project" → command preview → confirm → save); a developer should still spot-check it live before handoff.
