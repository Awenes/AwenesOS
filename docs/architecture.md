# Architecture

## Boundaries

The domain defines task source, status, evidence, legal transitions, and the CRM contract. `TaskService` implements the workflow. `TaskRepository` persists tasks and append-only events with Drizzle. Production v0.1 uses `ManualCrmAdapter`; the mock adapter is retained for automatic-adapter tests.

## Completion reliability

Preparing completion saves an editable description and moves the task to `ready_to_complete`. Finishing work moves it to `sync_pending` and queues a manual `Completed` instruction. The task reaches `completed` only after the user verifies the external CRM and confirms the update in Awenes.

Automatic adapters remain replaceable behind the CRM port. They can be enabled later if mutation access and a safe test environment become available.

## Data

- `tasks`: current projection used for fast queues.
- `task_events`: audit history of workflow changes.
- `task_evidence`: notes, commits, files, tests, builds, and links.
- `crm_mappings`: relationship between local tasks and adapter-specific project/task IDs.
- `manual_crm_updates`: pending, confirmed, and superseded user reconciliation instructions.

## Database evolution and recovery

Schema changes run through the ordered `_awenes_migrations` ledger. A file-backed legacy or outdated database is checkpointed and copied to `data/backups` before any pending migration runs. Each migration and its ledger entry execute in one write transaction. In-memory test databases migrate without file backups.

`awenes doctor` checks SQLite integrity, foreign-key violations, and schema version. `awenes backup` creates an explicit checkpointed copy without changing task history.
