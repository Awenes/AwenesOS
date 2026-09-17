# AwenesOS

AwenesOS is a local-first Windows command center for developers working with coding agents across multiple projects. It accepts work, coordinates specialized agent roles, executes inside dedicated Git worktrees, captures verification evidence, and applies developer-controlled delivery policies.

Version `0.1.0` is an Electron acceptance candidate. The Tauri migration begins only after the physical QA cycle passes.

## What AwenesOS does

- Manages multiple local Git projects from one desktop application.
- Captures tasks from any source and keeps unclaimed work in the inbox.
- Runs `plan → implement → review → test → delivery` workflows.
- Supports OpenAI and Anthropic through API keys.
- Supports experimental Codex and Claude CLI connections using their existing login sessions.
- Assigns different providers, models, prompts, and skills to different agent roles.
- Preserves exact prompt and skill snapshots for every run.
- Executes changes in a dedicated task worktree instead of the developer's normal checkout.
- Restricts commands, environment variables, network intent, execution time, and agent capabilities.
- Tests configured localhost applications in an isolated Chrome or Edge profile.
- Captures screenshots, traces, assertions, console failures, and failed requests.
- Supports manual delivery, approval-before-push, and automatic-push project policies.
- Tracks active, paused, and total elapsed task time.
- Keeps task pause/resume state aligned with its workflow run.
- Supports reversible run archiving and audit-safe run deletion.
- Produces local notifications for approvals, failures, completed runs, and stalled work.

## Deliberate v0.1 exclusions

AwenesOS does not currently:

- integrate with CRM, SharePoint, or external task-management systems;
- support remote development environments;
- continue running after the computer sleeps;
- provide a cloud-hosted control plane;
- provide OS-level Windows process or network sandboxing; or
- use Tauri—the acceptance candidate is packaged with Electron.

Execution restrictions are enforced at the AwenesOS tool boundary. They must not be represented as an operating-system security sandbox.

## Installation

### Normal users

Install the current Windows release build from the project's release assets. The installer contains the desktop runtime, so normal users do not need Node.js, npm, or pnpm. Verify the checksum published with that specific build before running it.

### Contributors

Requirements:

- Windows 10 or later
- Node.js 22 or later
- pnpm 11 or later
- Git
- Chrome or Edge for browser verification

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
pnpm desktop:start
```

Create an installer with:

```powershell
pnpm package:win
```

## First run

1. Open **Projects** and register a local Git repository.
2. Open **Safety**, select the project, and run its readiness check.
3. Review whether agent runtime access should be granted automatically. Git push approval is configured separately.
4. Open **Providers** and connect OpenAI or Anthropic.
5. Open **Agents**, assign a ready provider and model to every enabled role, then review prompts and skills.
6. Open **Tasks**, capture a task, claim it, and create its run.
7. Approve the exact run snapshot in **Approvals**.
8. Advance the workflow from **Runs** and inspect each stage's output.
9. Review browser evidence and the Git diff when applicable.
10. Review the completion evidence and finish the task locally.

### Set up a localhost browser test

1. Open **Safety**, choose a project, and select **Suggest setup from project**.
2. Review the suggested dev command, URL, health-check URL, and Chrome/Edge path. A `package.json` script and installed browser are detected when possible; non-Node projects can be entered manually.
3. Confirm the exact command and localhost access, then save. Detection itself does not run any command or change permissions.
4. Open a run with a task worktree and select **Run browser test**. AwenesOS starts the configured server in that worktree, waits for the health URL, runs checks in an isolated browser profile, and saves evidence.

Use the base URL as the health-check URL when the app has no separate health endpoint. If several scripts are found or the port is unclear, select the right script and correct the URL before saving. This setup does not grant public-network access or Git push approval.

## Desktop areas

| Area          | Purpose                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| Overview      | Setup progress, cross-project activity, workflow history, and approvals         |
| Projects      | Repository registration and delivery-policy selection                           |
| Tasks         | Capture, assignment, lifecycle, timing, evidence, and local completion          |
| Runs          | Agent stages, retries, browser evidence, diff review, commit, and push          |
| Approvals     | Durable developer decisions for sensitive workflow actions                      |
| Agents        | Roles, provider/model assignments, versioned prompts, and skill snapshots       |
| Providers     | OpenAI/Anthropic API and experimental CLI connections                           |
| Notifications | Approval, failure, completion, and stale-task reminders                         |
| Safety        | Readiness, network policy, allowlists, timeouts, credentials, and browser setup |

## Core lifecycle

Tasks follow this local state model:

```text
captured → assigned/planned → in_progress ↔ paused
         → ready_to_complete → completed
```

Workflow runs are separate from task state. A run can be created, running, awaiting approval, paused, failed, completed, or cancelled. The developer reviews the run evidence before finishing the task locally.

## Safety model

Defaults are intentionally restrictive:

- one writable task worktree per project;
- provider network and executable access granted automatically when the project enables that option;
- no localhost access until the developer confirms browser setup or selects it in Safety;
- explicit command and environment-variable allowlists;
- role-based tool access;
- bounded agent turns, retries, and process duration;
- child-process cleanup;
- disposable browser profiles;
- no access to the developer's normal browser profile; and
- durable approval before Git push when required by policy.

When automatic runtime access is disabled, provider traffic requires a manual public-network grant. Browser setup grants only localhost access after explicit confirmation. Git push approval is never implied by agent runtime access.

## Data and privacy

- Product state is stored locally in SQLite.
- Provider keys and browser-test credentials are stored outside SQLite using Electron safe storage.
- Prompt versions, skill hashes, workflow decisions, and lifecycle changes are retained as audit evidence.
- No telemetry is included in v0.1.

## Quality gates

Before handoff, run `pnpm check`, `pnpm test`, `pnpm build`, and `pnpm test:desktop-smoke`. If the local pnpm launcher cannot run, the equivalent `npm run` scripts use the installed dependencies. Physical Windows QA remains mandatory before the Tauri migration.

## Documentation

- [QA testing guide](docs/qa-testing-guide.md)
- [Desktop command center](docs/desktop-preview.md)
- [Architecture](docs/architecture.md)
- [Coding standards](docs/coding-standards.md)
- [CLI reference](docs/cli.md)
- [Acceptance checkpoint](.ai/checkpoints/0011-electron-v01-acceptance.md)

## License

MIT license.
