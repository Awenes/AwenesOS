import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sourceReference: text("source_reference"),
  assignmentDescription: text("assignment_description").notNull().default(""),
  completionDescription: text("completion_description"),
  status: text("status").notNull(),
  assignedToMe: integer("assigned_to_me", { mode: "boolean" }).notNull().default(false),
  syncError: text("sync_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" })
  ,acceptanceCriteria: text("acceptance_criteria", { mode: "json" }).$type<string[]>().notNull().default([]),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" })
});

export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  type: text("type").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull()
});

export const evidence = sqliteTable("task_evidence", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const crmMappings = sqliteTable("crm_mappings", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  adapter: text("adapter").notNull(),
  projectId: text("project_id").notNull(),
  externalTaskId: text("external_task_id").notNull(),
  externalUrl: text("external_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("crm_mapping_task_adapter_unique").on(table.taskId, table.adapter)]);

export const trackerUpdates = sqliteTable("tracker_updates", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  reference: text("reference").notNull(),
  suggestedStatus: text("suggested_status").notNull(),
  suggestedComment: text("suggested_comment").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" })
}, (table) => [uniqueIndex("tracker_update_task_unique").on(table.taskId)]);

export const taskRepositories = sqliteTable("task_repositories", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  repositoryRoot: text("repository_root").notNull(),
  branchAtMapping: text("branch_at_mapping").notNull(),
  headAtMapping: text("head_at_mapping").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("task_repository_task_unique").on(table.taskId)]);

export const notificationPreferences = sqliteTable("notification_preferences", {
  notificationKey: text("notification_key").primaryKey(), taskId: text("task_id").notNull().references(() => tasks.id),
  dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }), snoozedUntil: integer("snoozed_until", { mode: "timestamp_ms" }), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const manualCrmUpdates = sqliteTable("manual_crm_updates", {
  id: text("id").primaryKey(), taskId: text("task_id").notNull().references(() => tasks.id), desiredStatus: text("desired_status").notNull(), description: text("description"), status: text("status").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }), supersededAt: integer("superseded_at", { mode: "timestamp_ms" })
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repositoryRoot: text("repository_root").notNull(),
  defaultBranch: text("default_branch").notNull(),
  completionPolicy: text("completion_policy").notNull(),
  autonomyMode: text("autonomy_mode").notNull().default("balanced"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("projects_repository_root_unique").on(table.repositoryRoot)]);

export const projectEvents = sqliteTable("project_events", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  type: text("type").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull()
});

export const projectExecutionPolicies = sqliteTable("project_execution_policies", {
  projectId: text("project_id").primaryKey().references(() => projects.id),
  policy: text("policy", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskWorktrees = sqliteTable("task_worktrees", {
  id: text("id").primaryKey(), taskId: text("task_id").notNull().references(() => tasks.id), projectId: text("project_id").notNull().references(() => projects.id),
  path: text("path").notNull(), branch: text("branch").notNull(), baseBranch: text("base_branch").notNull(), status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), releasedAt: integer("released_at", { mode: "timestamp_ms" })
}, (table) => [uniqueIndex("task_worktrees_task_unique").on(table.taskId), uniqueIndex("task_worktrees_path_unique").on(table.path)]);

export const agentRoles = sqliteTable("agent_roles", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  scopeKey: text("scope_key").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  promptTemplate: text("prompt_template").notNull(),
  providerId: text("provider_id"),
  modelId: text("model_id"),
  capabilities: text("capabilities", { mode: "json" }).$type<string[]>().notNull(),
  limits: text("limits", { mode: "json" }).$type<Record<string, number>>().notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  builtIn: integer("built_in", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("agent_roles_scope_slug_unique").on(table.scopeKey, table.slug)]);

export const agentRoleEvents = sqliteTable("agent_role_events", {
  id: text("id").primaryKey(), roleId: text("role_id").notNull().references(() => agentRoles.id), type: text("type").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(), occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull()
});

export const providerConnections = sqliteTable("provider_connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  authMethod: text("auth_method").notNull(),
  command: text("command"),
  models: text("models", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" })
});

export const providerEvents = sqliteTable("provider_events", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providerConnections.id),
  type: text("type").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull()
});

export const rolePromptVersions = sqliteTable("role_prompt_versions", {
  id: text("id").primaryKey(), roleId: text("role_id").notNull().references(() => agentRoles.id), version: integer("version").notNull(),
  content: text("content").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("role_prompt_versions_role_version_unique").on(table.roleId, table.version)]);

export const skillSnapshots = sqliteTable("skill_snapshots", {
  id: text("id").primaryKey(), projectId: text("project_id").references(() => projects.id), source: text("source").notNull(), slug: text("slug").notNull(),
  name: text("name").notNull(), version: text("version").notNull(), content: text("content").notNull(), contentHash: text("content_hash").notNull(),
  permissions: text("permissions", { mode: "json" }).$type<string[]>().notNull(), reviewed: integer("reviewed", { mode: "boolean" }).notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("skill_snapshots_hash_unique").on(table.contentHash)]);

export const roleSkillSnapshots = sqliteTable("role_skill_snapshots", {
  roleId: text("role_id").notNull().references(() => agentRoles.id), skillSnapshotId: text("skill_snapshot_id").notNull().references(() => skillSnapshots.id),
  attachedAt: integer("attached_at", { mode: "timestamp_ms" }).notNull()
}, (table) => [uniqueIndex("role_skill_snapshots_unique").on(table.roleId, table.skillSnapshotId)]);

export const workflowRuns = sqliteTable("workflow_runs", {
  id:text("id").primaryKey(), taskId:text("task_id").notNull().references(()=>tasks.id), projectId:text("project_id").notNull().references(()=>projects.id),
  status:text("status").notNull(), currentStage:text("current_stage"), createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(), updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull(),
  startedAt:integer("started_at",{mode:"timestamp_ms"}), completedAt:integer("completed_at",{mode:"timestamp_ms"}), error:text("error"), revision:integer("revision").notNull().default(1), lastActivity:text("last_activity"), leaseOwner:text("lease_owner"), leaseExpiresAt:integer("lease_expires_at",{mode:"timestamp_ms"}), archivedAt:integer("archived_at",{mode:"timestamp_ms"}), deletedAt:integer("deleted_at",{mode:"timestamp_ms"})
});
export const workflowRunTombstones=sqliteTable("workflow_run_tombstones",{runId:text("run_id").primaryKey(),deletedAt:integer("deleted_at",{mode:"timestamp_ms"}).notNull()});
export const workflowPlans=sqliteTable("workflow_plans",{id:text("id").primaryKey(),runId:text("run_id").notNull().references(()=>workflowRuns.id),version:integer("version").notNull(),content:text("content").notNull(),status:text("status").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),decidedAt:integer("decided_at",{mode:"timestamp_ms"})},table=>[uniqueIndex("workflow_plans_run_version_unique").on(table.runId,table.version)]);
export const workflowInterventions=sqliteTable("workflow_interventions",{id:text("id").primaryKey(),runId:text("run_id").notNull().references(()=>workflowRuns.id),kind:text("kind").notNull(),title:text("title").notNull(),detail:text("detail").notNull(),status:text("status").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),resolvedAt:integer("resolved_at",{mode:"timestamp_ms"})});
export const taskTombstones=sqliteTable("task_tombstones",{taskId:text("task_id").primaryKey(),deletedAt:integer("deleted_at",{mode:"timestamp_ms"}).notNull()});
export const workflowSteps = sqliteTable("workflow_steps", {
  id:text("id").primaryKey(), runId:text("run_id").notNull().references(()=>workflowRuns.id), ordinal:integer("ordinal").notNull(), stage:text("stage").notNull(), roleId:text("role_id").references(()=>agentRoles.id),
  status:text("status").notNull(), attempt:integer("attempt").notNull(), instructionSnapshot:text("instruction_snapshot",{mode:"json"}).$type<Record<string,unknown>>(), output:text("output"), startedAt:integer("started_at",{mode:"timestamp_ms"}), completedAt:integer("completed_at",{mode:"timestamp_ms"})
});
export const workflowApprovals = sqliteTable("workflow_approvals", {
  id:text("id").primaryKey(), runId:text("run_id").notNull().references(()=>workflowRuns.id), kind:text("kind").notNull(), status:text("status").notNull(), detail:text("detail").notNull(), requestedAt:integer("requested_at",{mode:"timestamp_ms"}).notNull(), decidedAt:integer("decided_at",{mode:"timestamp_ms"})
});
export const workflowEvents = sqliteTable("workflow_events", {
  id:text("id").primaryKey(), runId:text("run_id").notNull().references(()=>workflowRuns.id), type:text("type").notNull(), data:text("data",{mode:"json"}).$type<Record<string,unknown>>().notNull(), occurredAt:integer("occurred_at",{mode:"timestamp_ms"}).notNull()
});
export const browserTestConfigs=sqliteTable("browser_test_configs",{projectId:text("project_id").primaryKey().references(()=>projects.id),config:text("config",{mode:"json"}).$type<Record<string,unknown>>().notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()});
export const browserTestEvidence=sqliteTable("browser_test_evidence",{id:text("id").primaryKey(),runId:text("run_id").notNull().references(()=>workflowRuns.id),passed:integer("passed",{mode:"boolean"}).notNull(),screenshotPath:text("screenshot_path"),tracePath:text("trace_path"),consoleErrors:text("console_errors",{mode:"json"}).$type<string[]>().notNull(),failedRequests:text("failed_requests",{mode:"json"}).$type<string[]>().notNull(),assertions:text("assertions",{mode:"json"}).$type<Array<Record<string,unknown>>>().notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()});
export const gitDeliveries=sqliteTable("git_deliveries",{id:text("id").primaryKey(),runId:text("run_id").notNull().references(()=>workflowRuns.id),branch:text("branch").notNull(),commitSha:text("commit_sha"),pushed:integer("pushed",{mode:"boolean"}).notNull(),remote:text("remote"),review:text("review",{mode:"json"}).$type<Record<string,unknown>>().notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("git_deliveries_run_unique").on(table.runId)]);
