# CLI reference

Run commands as `pnpm cli -- <command>`.

Run `pnpm cli` with no command for the guided daily workflow. It provides numbered menus for capture, inbox triage, active work, completion, history, and standup generation. `pnpm cli -- guided` opens the same experience explicitly.

| Command | Purpose |
| --- | --- |
| `guided` | Open the interactive daily workflow |
| `capture` | Add work from any supported source |
| `inbox` | List candidates and explicit assignments |
| `confirm`, `claim`, `reject` | Triage inbox work |
| `duration <taskId>` | Show active, paused, and calendar duration |
| `task-summary <taskId>` | Show task, timing, evidence, and repository details |
| `queue` | List planned and active work |
| `start`, `pause`, `resume` | Update execution state locally |
| `evidence` | Attach completion evidence |
| `git-evidence <id> [repository]` | Collect commit and changed-file metadata since the task started |
| `repo-attach <id> [repository]` | Validate and attach a local Git repository to planned or active work |
| `repo-show <id>` | Show a task's saved repository mapping |
| `prepare-completion` | Build or accept a completion description |
| `draft-completion <id>` | Preview a structured evidence-based draft without changing task state |
| `edit-completion` | Revise the description before finishing |
| `complete` | Mark a reviewed task complete locally |
| `history` | Show the task event trail |
| `standup [date] [-o file]` | Generate a Markdown standup for `today`, `yesterday`, or `YYYY-MM-DD` |
| `weekly-review [ending] [-o file]` | Generate a five-working-day Markdown review |
| `notifications` | List actionable local reminders |
| `notification-snooze <key> [duration]` | Hide a reminder for `30m`, `1h` (default), `2h`, `1d`, etc. |
| `notification-dismiss <key>` | Dismiss the current notification occurrence |
| `doctor` | Check database integrity, foreign keys, and migration version |
| `backup [-o file]` | Create a consistent database backup |

Use `pnpm cli -- <command> --help` for arguments and options.
# Project commands

`project-add <name> [repository]` registers a local Git repository. Use `--branch` to set its default branch and `--policy` to select `manual`, `approve_push`, or `auto_push` completion.

`projects` lists every registered project.

`project-doctor <projectId>` checks repository access, Git, Node.js, pnpm, and dedicated-worktree support without changing the project.

`project-policy <projectId> <policy>` changes the completion policy and records the change as an append-only event.

`task-project <taskId> <projectId>` assigns a task to a registered project. `project-tasks <projectId>` shows its queue.

`execution-policy-show <projectId>` displays the effective safety policy. `execution-policy-set <projectId> --config <file>` replaces it with a validated JSON policy and records an event.

`worktree-create <taskId>` creates the task's isolated branch and worktree. Only one active write worktree is allowed per project. `worktree-release <taskId>` removes the clean worktree through Git and records its release; Git refuses to remove a dirty worktree.

# Agent role commands

`roles [--project <projectId>]` lists global roles and, when provided, roles belonging to that project.

`role-show <roleId>` shows the complete role configuration. `role-create --config <file>` creates a validated custom role from JSON.

`role-model <roleId> --provider <providerId> --model <modelId>` assigns a provider and model together. `role-enable` and `role-disable` control whether a role is eligible for future workflows.
