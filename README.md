# Awenes OS v0.1

A local-first Windows work engine that closes the loop from assignment capture to externally confirmed completion and tomorrow's standup. The v0.1 interface is a TypeScript CLI; there is intentionally no dashboard yet.

## Prerequisites

- Windows with Node.js 22+
- pnpm 11+

## Start

```powershell
pnpm install
Copy-Item .env.example .env
pnpm cli -- capture "Fix guardian invite flow" --source teams --description "Prevent duplicate invites"
pnpm cli -- inbox
```

For normal daily use, launch the guided session:

```powershell
pnpm cli
```

Choose actions and tasks by number. Task IDs remain available in the explicit commands for automation, but the guided flow does not require copying them.

Register every local codebase once so Awenes can manage multiple projects and verify that each environment is safe to run:

```powershell
pnpm cli -- project-add "AwenesOS" . --policy manual
pnpm cli -- projects
pnpm cli -- project-doctor <project-id>
pnpm cli -- project-policy <project-id> approve_push
pnpm cli -- task-project <task-id> <project-id>
pnpm cli -- project-tasks <project-id>
pnpm cli -- execution-policy-show <project-id>
pnpm cli -- execution-policy-set <project-id> --config .\execution-policy.json
pnpm cli -- worktree-create <task-id>
```

Completion policies are `manual`, `approve_push`, and `auto_push`. Registration does not start an agent or modify the repository.

Execution policies are restrictive by default: public network access is disabled, environment variables and commands require allowlisting, browser profiles must be isolated, and Git push requires developer approval. `worktree-create` creates a task branch outside the normal checkout and prevents concurrent write work for the same project.

Configure provider-neutral agent roles:

```powershell
pnpm cli -- roles
pnpm cli -- roles --project <project-id>
pnpm cli -- role-create --config .\role.json
pnpm cli -- role-model <role-id> --provider openai --model <model-id>
pnpm cli -- role-disable <role-id>
```

See [agent roles](docs/agent-roles.md) for the built-in roles, capabilities, limits, and custom-role schema.

Use the returned task ID through the loop:

```powershell
pnpm cli -- claim <id>
pnpm cli -- crm-map <id> --project current-project --external-id CRM-123
pnpm cli -- start <id>
pnpm cli -- crm-updates
pnpm cli -- crm-confirm <id>
pnpm cli -- evidence <id> --kind commit --value "83fa21"
pnpm cli -- evidence <id> --kind test --value "Invite validation tests passed"
pnpm cli -- prepare-completion <id>
pnpm cli -- edit-completion <id> --description "Prevented duplicate invitations and added regression coverage."
pnpm cli -- complete <id>
pnpm cli -- crm-updates
pnpm cli -- crm-confirm <id>
pnpm cli -- duration <id>
pnpm cli -- task-summary <id>
pnpm cli -- history <id>
pnpm cli -- standup
```

`crm-map` records an existing CRM reference; it does not create or change anything externally. Start, pause, resume, and finish actions queue a manual CRM instruction. After applying the latest instruction in the live CRM, run `crm-confirm <id>`. Completion stays `sync_pending` until that confirmation.

## State model

`captured → assigned → planned → in_progress ↔ paused → ready_to_complete → sync_pending → completed`

Claiming permits `captured → planned`. A local completion remains `sync_pending` until the CRM confirms its description and completed status update.

See [architecture](docs/architecture.md), [CLI reference](docs/cli.md), and [CRM investigation checklist](docs/crm-adapter.md).
