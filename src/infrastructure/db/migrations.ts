export interface DatabaseMigration { version: number; name: string; statements: string[]; }

export const databaseMigrations: DatabaseMigration[] = [{
  version: 1,
  name: "initial_local_work_engine",
  statements: [
    `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, source_reference TEXT, assignment_description TEXT NOT NULL DEFAULT '', completion_description TEXT, status TEXT NOT NULL, assigned_to_me INTEGER NOT NULL DEFAULT 0, sync_error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER)`,
    `CREATE TABLE IF NOT EXISTS task_events (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), type TEXT NOT NULL, data TEXT NOT NULL, occurred_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS task_events_task_id_idx ON task_events(task_id)`,
    `CREATE TABLE IF NOT EXISTS task_evidence (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), kind TEXT NOT NULL, value TEXT NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS crm_mappings (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), adapter TEXT NOT NULL, project_id TEXT NOT NULL, external_task_id TEXT NOT NULL, external_url TEXT, created_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS crm_mapping_task_adapter_unique ON crm_mappings(task_id, adapter)`,
    `CREATE TABLE IF NOT EXISTS tracker_updates (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), reference TEXT NOT NULL, suggested_status TEXT NOT NULL, suggested_comment TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, confirmed_at INTEGER)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tracker_update_task_unique ON tracker_updates(task_id)`,
    `CREATE TABLE IF NOT EXISTS task_repositories (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), repository_root TEXT NOT NULL, branch_at_mapping TEXT NOT NULL, head_at_mapping TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS task_repository_task_unique ON task_repositories(task_id)`,
    `CREATE TABLE IF NOT EXISTS notification_preferences (notification_key TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), dismissed_at INTEGER, snoozed_until INTEGER, updated_at INTEGER NOT NULL)`
  ]
}, {
  version: 2,
  name: "manual_crm_coordination",
  statements: [
    `CREATE TABLE IF NOT EXISTS manual_crm_updates (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), desired_status TEXT NOT NULL, description TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, confirmed_at INTEGER, superseded_at INTEGER)`,
    `CREATE INDEX IF NOT EXISTS manual_crm_updates_task_status_idx ON manual_crm_updates(task_id, status)`
  ]
}];

export const currentDatabaseVersion = databaseMigrations.at(-1)?.version ?? 0;
