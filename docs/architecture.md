# Architecture

## Boundaries

The domain defines task source, status, evidence, legal transitions, and execution policy. `TaskService` implements the local task workflow. `TaskRepository` persists tasks and append-only events with Drizzle.

## Completion reliability

Preparing completion saves an editable description and moves the task to `ready_to_complete`. Finishing work moves it directly to `completed` and records the local completion event. CRM, SharePoint, and external task-management coordination are outside the product workflow.

## Data

- `tasks`: current projection used for fast queues.
- `task_events`: audit history of workflow changes.
- `task_evidence`: notes, commits, files, tests, builds, and links.

Legacy CRM and tracker tables remain migration-compatible for existing local databases, but current desktop workflows neither create nor surface those records.

## Database evolution and recovery

Schema changes run through the ordered `_awenes_migrations` ledger. A file-backed legacy or outdated database is checkpointed and copied to `data/backups` before any pending migration runs. Each migration and its ledger entry execute in one write transaction. In-memory test databases migrate without file backups.

`awenes doctor` checks SQLite integrity, foreign-key violations, and schema version. `awenes backup` creates an explicit checkpointed copy without changing task history.
