# AwenesOS v0.1

AwenesOS is a local-first Windows command center for developers who use agents across multiple local projects. It captures tasks, runs provider-neutral agent workflows in dedicated Git worktrees, gathers evidence, gates sensitive actions, and keeps external CRM and SharePoint updates manual and explicit.

The desktop app is the primary interface. The CLI remains available for diagnostics and scripted workflows.

## Install the desktop app

Run `release/AwenesOS-Setup-0.1.0.exe` and follow the installer. End users do not need Node.js, npm, or pnpm; the packaged application includes its runtime.

## First-use walkthrough

1. Register a local Git repository in **Projects**.
2. Open **Safety**, run the readiness check, and review the project policy.
3. Connect OpenAI or Anthropic in **Providers** using an API key, or use the experimental Codex/Claude CLI login when that tool is already installed and signed in.
4. In **Agents**, enable the roles you want, assign each a ready provider/model, review its prompt, and attach reviewed skill snapshots.
5. Capture a task in **Tasks**, claim it, and create a run.
6. Approve the start request in **Approvals**, then advance the stages from **Runs**.
7. Review evidence and the Git diff. Depending on the project policy, finish manually, commit locally, or approve and push.
8. Update the live CRM or SharePoint tracker yourself when prompted, then confirm the update in AwenesOS. Completion remains pending until that confirmation.

## Development

Requires Node.js 22+ and pnpm 11+.

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
pnpm desktop:start
pnpm package:win
```

Execution is restrictive by default: work happens in a dedicated worktree, commands and environment variables require allowlisting, public network access is disabled, localhost is a separate permission, browser tests use an isolated profile, and Git push requires a stored developer approval. AwenesOS does not claim OS-level process or network isolation on Windows.

See [desktop guide](docs/desktop-preview.md), [architecture](docs/architecture.md), [CLI reference](docs/cli.md), and [CRM workflow](docs/crm-adapter.md).
