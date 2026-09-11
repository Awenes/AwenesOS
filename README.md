# AwenesOS

AwenesOS is a local-first Windows command center for developers working with coding agents across multiple projects. It accepts work, coordinates specialized agent roles, executes inside dedicated Git worktrees, captures verification evidence, and applies developer-controlled delivery policies.

Version `0.1.0` is an Electron acceptance candidate. The Tauri migration begins only after the physical QA cycle passes.

## What AwenesOS does

- Manages multiple local Git projects from one desktop application.
- Captures manual tasks and tracker candidates without silently claiming them.
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
- Keeps CRM and SharePoint tracker changes manual and waits for developer confirmation.
- Tracks active, paused, and total elapsed task time.
- Produces local notifications for approvals, failures, completed runs, and pending external updates.

## Deliberate v0.1 exclusions

AwenesOS does not currently:

- mutate CRM or SharePoint data automatically;
- support remote development environments;
- continue running after the computer sleeps;
- provide a cloud-hosted control plane;
- provide OS-level Windows process or network sandboxing; or
- use Tauri—the acceptance candidate is packaged with Electron.

Execution restrictions are enforced at the AwenesOS tool boundary. They must not be represented as an operating-system security sandbox.

## Installation

### Normal users

Install [AwenesOS-Setup-0.1.0.exe](release/AwenesOS-Setup-0.1.0.exe). The installer contains the desktop runtime, so users do not need Node.js, npm, or pnpm.

Current acceptance build:

- Size: `119,127,148` bytes
- SHA-256: `86B086500F5C068278EE042C75C3E5EDCBD9AD63BE288F9F00E8FFAD37D4BD25`

Windows may display a reputation warning for an independently distributed acceptance build. Confirm that the filename and checksum match before continuing.

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
3. Review the default policy before granting commands, environment variables, localhost, or public-network access.
4. Open **Providers** and connect OpenAI or Anthropic.
5. Open **Agents**, assign a ready provider and model to every enabled role, then review prompts and skills.
6. Open **Tasks**, capture a task, claim it, and create its run.
7. Approve the exact run snapshot in **Approvals**.
8. Advance the workflow from **Runs** and inspect each stage's output.
9. Review browser evidence and the Git diff when applicable.
10. Complete the required CRM or SharePoint change manually, then confirm it in AwenesOS.

## Desktop areas

| Area          | Purpose                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| Overview      | Setup progress, cross-project activity, and pending manual updates              |
| Projects      | Repository registration and delivery-policy selection                           |
| Tasks         | Capture, assignment, lifecycle, timing, evidence, and external confirmations    |
| Runs          | Agent stages, retries, browser evidence, diff review, commit, and push          |
| Approvals     | Durable developer decisions for sensitive workflow actions                      |
| Agents        | Roles, provider/model assignments, versioned prompts, and skill snapshots       |
| Providers     | OpenAI/Anthropic API and experimental CLI connections                           |
| Notifications | Approval, failure, completion, CRM, tracker, and stale-task reminders           |
| Safety        | Readiness, network policy, allowlists, timeouts, credentials, and browser setup |

## Core lifecycle

Tasks follow this local state model:

```text
captured → assigned/planned → in_progress ↔ paused
         → ready_to_complete → sync_pending → completed
```

A local task is not considered externally complete until the developer confirms the corresponding CRM update. Bug-tracker tasks can additionally require a manual SharePoint tracker confirmation.

Workflow runs are separate from task state. A run can be created, running, awaiting approval, paused, failed, completed, or cancelled. Completing an agent run does not bypass the external task-confirmation rule.

## Safety model

Defaults are intentionally restrictive:

- one writable task worktree per project;
- no public-network access;
- no localhost access until separately selected;
- explicit command and environment-variable allowlists;
- role-based tool access;
- bounded agent turns, retries, and process duration;
- child-process cleanup;
- disposable browser profiles;
- no access to the developer's normal browser profile; and
- durable approval before Git push when required by policy.

API-provider traffic also requires the project's public-network grant. Browser verification requires the separate localhost grant.

## Data and privacy

- Product state is stored locally in SQLite.
- Provider keys and browser-test credentials are stored outside SQLite using Electron safe storage.
- Prompt versions, skill hashes, workflow decisions, and lifecycle changes are retained as audit evidence.
- No telemetry is included in v0.1.

## Quality gates

The current acceptance candidate passes:

- TypeScript checks for core, Electron, and renderer code;
- 49 automated tests across 23 test files;
- a real isolated-Chrome browser test;
- a real Git review/commit/push test against a temporary remote;
- a production renderer/main-process build; and
- packaged startup and archive-content verification.

Physical QA remains mandatory before the Tauri migration.

## Documentation

- [QA testing guide](docs/qa-testing-guide.md)
- [Desktop command center](docs/desktop-preview.md)
- [Architecture](docs/architecture.md)
- [CLI reference](docs/cli.md)
- [CRM workflow](docs/crm-adapter.md)
- [Acceptance checkpoint](.ai/checkpoints/0011-electron-v01-acceptance.md)

## License

No open-source license has been declared. Treat the repository as proprietary unless the owner adds a license.
