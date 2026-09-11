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
}, {
  version: 7,
  name: "prompt_and_skill_snapshots",
  statements: [
    `CREATE TABLE IF NOT EXISTS role_prompt_versions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES agent_roles(id), version INTEGER NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS role_prompt_versions_role_version_unique ON role_prompt_versions(role_id, version)`,
    `CREATE TABLE IF NOT EXISTS skill_snapshots (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), source TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, version TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL, permissions TEXT NOT NULL, reviewed INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS skill_snapshots_hash_unique ON skill_snapshots(content_hash)`,
    `CREATE TABLE IF NOT EXISTS role_skill_snapshots (role_id TEXT NOT NULL REFERENCES agent_roles(id), skill_snapshot_id TEXT NOT NULL REFERENCES skill_snapshots(id), attached_at INTEGER NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS role_skill_snapshots_unique ON role_skill_snapshots(role_id, skill_snapshot_id)`
  ]
}, {
  version: 8,
  name: "durable_workflow_runs",
  statements: [
    `CREATE TABLE IF NOT EXISTS workflow_runs (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), project_id TEXT NOT NULL REFERENCES projects(id), status TEXT NOT NULL, current_stage TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, started_at INTEGER, completed_at INTEGER, error TEXT)`,
    `CREATE TABLE IF NOT EXISTS workflow_steps (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES workflow_runs(id), ordinal INTEGER NOT NULL, stage TEXT NOT NULL, role_id TEXT REFERENCES agent_roles(id), status TEXT NOT NULL, attempt INTEGER NOT NULL, instruction_snapshot TEXT, output TEXT, started_at INTEGER, completed_at INTEGER)`,
    `CREATE TABLE IF NOT EXISTS workflow_approvals (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES workflow_runs(id), kind TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, requested_at INTEGER NOT NULL, decided_at INTEGER)`,
    `CREATE TABLE IF NOT EXISTS workflow_events (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES workflow_runs(id), type TEXT NOT NULL, data TEXT NOT NULL, occurred_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS workflow_runs_task_idx ON workflow_runs(task_id)`, `CREATE INDEX IF NOT EXISTS workflow_steps_run_idx ON workflow_steps(run_id)`,
    `CREATE INDEX IF NOT EXISTS workflow_approvals_run_idx ON workflow_approvals(run_id)`, `CREATE INDEX IF NOT EXISTS workflow_events_run_idx ON workflow_events(run_id)`
  ]
}, {
  version: 9,
  name: "localhost_browser_testing",
  statements: [
    `CREATE TABLE IF NOT EXISTS browser_test_configs (project_id TEXT PRIMARY KEY REFERENCES projects(id), config TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS browser_test_evidence (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES workflow_runs(id), passed INTEGER NOT NULL, screenshot_path TEXT, trace_path TEXT, console_errors TEXT NOT NULL, failed_requests TEXT NOT NULL, assertions TEXT NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS browser_test_evidence_run_idx ON browser_test_evidence(run_id)`
  ]
}];

export const currentDatabaseVersion = databaseMigrations.at(-1)?.version ?? 0;
