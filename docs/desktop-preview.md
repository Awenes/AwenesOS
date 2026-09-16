# Desktop command center

The Electron v0.1 desktop application is the primary AwenesOS interface. It stores its database and encrypted provider credentials in the user's Windows application-data directory. Development runs use `data/awenes.db` unless `AWENES_DB_PATH` is set.

## Product areas

- **Overview** — onboarding, multi-project activity, and pending manual updates.
- **Projects** — local repository registration and delivery policy.
- **Tasks** — capture, lifecycle actions, duration, evidence, and local completion.
- **Runs** — plan, implementation, review, test, browser evidence, and Git delivery.
- **Approvals** — durable decisions for start, network, credentials, commit, push, and completion gates.
- **Agents** — provider/model assignments, versioned prompts, effective-instruction preview, and immutable skill snapshots.
- **Providers** — OpenAI and Anthropic API-key connections plus experimental Codex and Claude CLI login checks.
- **Notifications** — actionable local reminders with dismiss and snooze controls.
- **Safety** — readiness checks, allowlists, timeouts, network intent, isolated-browser settings, credentials, and localhost tests.

## Security boundary

- The renderer is sandboxed, context-isolated, and has no Node.js access.
- IPC calls are named, sender-checked, and Zod-validated.
- Worktree tools constrain reads and writes to the assigned worktree.
- Browser testing uses a disposable profile and an explicit localhost origin.
- Provider secrets are stored outside SQLite with Electron safe storage.
- Push authorization is checked against durable approval history in the trusted main process.
- Windows process/network isolation is policy enforcement at the Awenes tool boundary, not an OS sandbox guarantee.

The CLI remains supported for diagnostics, tracker imports, and scripted local operation.
