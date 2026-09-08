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
