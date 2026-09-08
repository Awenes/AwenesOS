import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
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
