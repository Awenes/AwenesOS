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
}, {
  version: 3,
  name: "multi_project_registry",
  statements: [
    `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, repository_root TEXT NOT NULL, default_branch TEXT NOT NULL, completion_policy TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS projects_repository_root_unique ON projects(repository_root)`,
    `CREATE TABLE IF NOT EXISTS project_events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), type TEXT NOT NULL, data TEXT NOT NULL, occurred_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS project_events_project_id_idx ON project_events(project_id)`
  ]
}, {
  version: 4,
  name: "task_projects_policies_and_worktrees",
  statements: [
    `ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id)`,
    `CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id)`,
    `CREATE TABLE IF NOT EXISTS project_execution_policies (project_id TEXT PRIMARY KEY REFERENCES projects(id), policy TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS task_worktrees (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), project_id TEXT NOT NULL REFERENCES projects(id), path TEXT NOT NULL, branch TEXT NOT NULL, base_branch TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, released_at INTEGER)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS task_worktrees_task_unique ON task_worktrees(task_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS task_worktrees_path_unique ON task_worktrees(path)`
  ]
}, {
  version: 5,
  name: "provider_neutral_agent_roles",
  statements: [
    `CREATE TABLE IF NOT EXISTS agent_roles (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), scope_key TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, prompt_template TEXT NOT NULL, provider_id TEXT, model_id TEXT, capabilities TEXT NOT NULL, limits TEXT NOT NULL, enabled INTEGER NOT NULL, built_in INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS agent_roles_scope_slug_unique ON agent_roles(scope_key, slug)`,
    `CREATE TABLE IF NOT EXISTS agent_role_events (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES agent_roles(id), type TEXT NOT NULL, data TEXT NOT NULL, occurred_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS agent_role_events_role_id_idx ON agent_role_events(role_id)`
  ]
}, {
  version: 6,
  name: "provider_connections",
  statements: [
    `CREATE TABLE IF NOT EXISTS provider_connections (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, auth_method TEXT NOT NULL, command TEXT, models TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_checked_at INTEGER)`,
    `CREATE TABLE IF NOT EXISTS provider_events (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES provider_connections(id), type TEXT NOT NULL, data TEXT NOT NULL, occurred_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS provider_events_provider_id_idx ON provider_events(provider_id)`
  ]
}];

export const currentDatabaseVersion = databaseMigrations.at(-1)?.version ?? 0;
