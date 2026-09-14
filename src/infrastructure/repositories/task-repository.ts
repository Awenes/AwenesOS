import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { CrmTaskMapping } from "../../domain/crm.js";
import type { CaptureTask, EvidenceKind, Task, TaskStatus } from "../../domain/task.js";
import type { NotificationPreference } from "../../domain/notification.js";
import type { Database } from "../db/database.js";
import { crmMappings, evidence, manualCrmUpdates, notificationPreferences, taskEvents, taskRepositories, tasks, trackerUpdates } from "../db/schema.js";

export interface ManualTrackerUpdate {
  id: string;
  taskId: string;
  reference: string;
  suggestedStatus: string;
  suggestedComment: string;
  status: "pending" | "confirmed";
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface TaskRepositoryMapping {
  taskId: string;
  repositoryRoot: string;
  branchAtMapping: string;
  headAtMapping: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ManualCrmUpdate { id: string; taskId: string; desiredStatus: string; description: string | null; status: "pending" | "confirmed" | "superseded"; createdAt: Date; confirmedAt: Date | null; supersededAt: Date | null; }

export class TaskRepository {
  constructor(private readonly db: Database) {}

  async create(input: CaptureTask): Promise<Task> {
    const now = input.occurredAt ?? new Date();
    const task: Task = { id: randomUUID(), projectId: null, title: input.title, source: input.source, sourceReference: input.sourceReference ?? null, assignmentDescription: input.assignmentDescription ?? "", completionDescription: null, status: input.assignedToMe ? "assigned" : "captured", assignedToMe: input.assignedToMe ?? false, syncError: null, createdAt: now, updatedAt: now, completedAt: null, acceptanceCriteria: input.acceptanceCriteria ?? [], archivedAt: null, deletedAt: null };
    await this.db.insert(tasks).values(task);
    await this.event(task.id, "task.captured", { source: task.source, assignedToMe: task.assignedToMe }, now);
    return task;
  }

  async get(id: string): Promise<Task> {
    const row = await this.db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!row) throw new Error(`Task not found: ${id}`);
    return row as Task;
  }

  async list(statuses?: TaskStatus[]): Promise<Task[]> {
    const rows = await this.db.select().from(tasks).where(statuses?.length ? inArray(tasks.status, statuses) : undefined).orderBy(desc(tasks.updatedAt));
    return rows as Task[];
  }

  async listForProject(projectId: string): Promise<Task[]> {
    return await this.db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.updatedAt)) as Task[];
  }

  async findBySourceReference(sourceReference: string): Promise<Task | null> {
    const row = await this.db.query.tasks.findFirst({ where: eq(tasks.sourceReference, sourceReference) });
    return row ? row as Task : null;
  }

  async assignProject(taskId: string, projectId: string): Promise<Task> {
    const task = await this.get(taskId); const now = new Date();
    await this.db.update(tasks).set({ projectId, updatedAt: now }).where(eq(tasks.id, taskId));
    await this.event(taskId, task.projectId ? "task.project_reassigned" : "task.project_assigned", { from: task.projectId, to: projectId }, now);
    return this.get(taskId);
  }

  async transition(id: string, from: TaskStatus, to: TaskStatus, eventType: string, data: Record<string, unknown> = {}): Promise<Task> {
    const now = new Date();
    const changed = await this.db.update(tasks).set({ status: to, updatedAt: now, syncError: null }).where(and(eq(tasks.id, id), eq(tasks.status, from))).returning();
    if (!changed[0]) throw new Error(`Task ${id} is no longer ${from}; refresh and try again`);
    await this.event(id, eventType, { from, to, ...data }, now);
    return changed[0] as Task;
  }

  async setCompletion(id: string, description: string): Promise<void> {
    await this.db.update(tasks).set({ completionDescription: description, updatedAt: new Date() }).where(eq(tasks.id, id));
    await this.event(id, "task.completion_description_updated", { description });
  }

  async markCompleted(id: string, now = new Date()): Promise<Task> {
    await this.db.update(tasks).set({ status: "completed", completedAt: now, updatedAt: now, syncError: null }).where(eq(tasks.id, id));
    await this.event(id, "task.crm_sync_succeeded", {}, now);
    return this.get(id);
  }

  async markSyncFailure(id: string, message: string): Promise<void> {
    await this.db.update(tasks).set({ status: "sync_pending", syncError: message, updatedAt: new Date() }).where(eq(tasks.id, id));
    await this.event(id, "task.crm_sync_failed", { message });
  }

  async addEvidence(taskId: string, kind: EvidenceKind, value: string): Promise<void> {
    await this.db.insert(evidence).values({ id: randomUUID(), taskId, kind, value, createdAt: new Date() });
    await this.event(taskId, "task.evidence_added", { kind, value });
  }

  async evidenceFor(taskId: string) { return this.db.select().from(evidence).where(eq(evidence.taskId, taskId)).orderBy(asc(evidence.createdAt)); }
  async hasEvidence(taskId: string, kind: EvidenceKind, value: string): Promise<boolean> {
    return Boolean(await this.db.query.evidence.findFirst({ where: and(eq(evidence.taskId, taskId), eq(evidence.kind, kind), eq(evidence.value, value)) }));
  }
  async history(taskId: string) { return this.db.select().from(taskEvents).where(eq(taskEvents.taskId, taskId)).orderBy(asc(taskEvents.occurredAt)); }

  async saveMapping(mapping: CrmTaskMapping): Promise<void> {
    await this.db.insert(crmMappings).values({ id: randomUUID(), ...mapping, createdAt: new Date() }).onConflictDoUpdate({ target: [crmMappings.taskId, crmMappings.adapter], set: { projectId: mapping.projectId, externalTaskId: mapping.externalTaskId, externalUrl: mapping.externalUrl } });
    await this.event(mapping.taskId, "task.crm_mapped", { ...mapping });
  }

  async mapping(taskId: string, adapter: string): Promise<CrmTaskMapping | null> {
    const row = await this.db.query.crmMappings.findFirst({ where: and(eq(crmMappings.taskId, taskId), eq(crmMappings.adapter, adapter)) });
    return row ? { taskId: row.taskId, adapter: row.adapter, projectId: row.projectId, externalTaskId: row.externalTaskId, externalUrl: row.externalUrl } : null;
  }

  async queueTrackerUpdate(task: Task): Promise<ManualTrackerUpdate> {
    if (task.source !== "bug-tracker") throw new Error("Only bug-tracker tasks require a manual tracker update");
    if (!task.completionDescription) throw new Error("A completion description is required for the tracker update");
    const now = new Date();
    const update: ManualTrackerUpdate = { id: randomUUID(), taskId: task.id, reference: task.sourceReference ?? task.title, suggestedStatus: "Completed", suggestedComment: task.completionDescription, status: "pending", createdAt: now, confirmedAt: null };
    await this.db.insert(trackerUpdates).values(update).onConflictDoUpdate({ target: trackerUpdates.taskId, set: { reference: update.reference, suggestedStatus: update.suggestedStatus, suggestedComment: update.suggestedComment, status: "pending", createdAt: now, confirmedAt: null } });
    await this.event(task.id, "task.tracker_manual_update_requested", { reference: update.reference, suggestedStatus: update.suggestedStatus }, now);
    const stored = await this.db.query.trackerUpdates.findFirst({ where: eq(trackerUpdates.taskId, task.id) });
    return stored as ManualTrackerUpdate;
  }

  async pendingTrackerUpdates(): Promise<ManualTrackerUpdate[]> {
    return await this.db.select().from(trackerUpdates).where(eq(trackerUpdates.status, "pending")).orderBy(asc(trackerUpdates.createdAt)) as ManualTrackerUpdate[];
  }

  async confirmTrackerUpdate(taskId: string): Promise<ManualTrackerUpdate> {
    const now = new Date();
    const changed = await this.db.update(trackerUpdates).set({ status: "confirmed", confirmedAt: now }).where(and(eq(trackerUpdates.taskId, taskId), eq(trackerUpdates.status, "pending"))).returning();
    if (!changed[0]) throw new Error(`No pending manual tracker update for task ${taskId}`);
    await this.event(taskId, "task.tracker_manual_update_confirmed", {}, now);
    return changed[0] as ManualTrackerUpdate;
  }

  async saveRepositoryMapping(mapping: Omit<TaskRepositoryMapping, "createdAt" | "updatedAt">): Promise<TaskRepositoryMapping> {
    const now = new Date();
    const existing = await this.repositoryMapping(mapping.taskId);
    await this.db.insert(taskRepositories).values({ id: randomUUID(), ...mapping, createdAt: existing?.createdAt ?? now, updatedAt: now }).onConflictDoUpdate({ target: taskRepositories.taskId, set: { repositoryRoot: mapping.repositoryRoot, branchAtMapping: mapping.branchAtMapping, headAtMapping: mapping.headAtMapping, updatedAt: now } });
    await this.event(mapping.taskId, existing ? "task.repository_remapped" : "task.repository_mapped", { repositoryRoot: mapping.repositoryRoot, branchAtMapping: mapping.branchAtMapping, headAtMapping: mapping.headAtMapping }, now);
    return (await this.repositoryMapping(mapping.taskId))!;
  }

  async repositoryMapping(taskId: string): Promise<TaskRepositoryMapping | null> {
    const row = await this.db.query.taskRepositories.findFirst({ where: eq(taskRepositories.taskId, taskId) });
    return row ? row as TaskRepositoryMapping : null;
  }
  async notificationPreferences(): Promise<NotificationPreference[]> { return await this.db.select().from(notificationPreferences) as NotificationPreference[]; }
  async saveNotificationPreference(preference: NotificationPreference, eventType: string): Promise<NotificationPreference> {
    await this.db.insert(notificationPreferences).values(preference).onConflictDoUpdate({ target: notificationPreferences.notificationKey, set: { dismissedAt: preference.dismissedAt, snoozedUntil: preference.snoozedUntil, updatedAt: preference.updatedAt } });
    await this.event(preference.taskId, eventType, { notificationKey: preference.notificationKey, snoozedUntil: preference.snoozedUntil?.toISOString() ?? null }, preference.updatedAt); return preference;
  }

  async queueManualCrmUpdate(taskId: string, desiredStatus: string, description: string | null = null): Promise<ManualCrmUpdate> {
    await this.get(taskId); const now = new Date();
    await this.db.update(manualCrmUpdates).set({ status: "superseded", supersededAt: now }).where(and(eq(manualCrmUpdates.taskId, taskId), eq(manualCrmUpdates.status, "pending")));
    const update: ManualCrmUpdate = { id: randomUUID(), taskId, desiredStatus, description, status: "pending", createdAt: now, confirmedAt: null, supersededAt: null };
    await this.db.insert(manualCrmUpdates).values(update);
    await this.event(taskId, "task.crm_manual_update_requested", { desiredStatus, description }, now); return update;
  }
  async pendingManualCrmUpdates(): Promise<ManualCrmUpdate[]> { return await this.db.select().from(manualCrmUpdates).where(eq(manualCrmUpdates.status, "pending")).orderBy(asc(manualCrmUpdates.createdAt)) as ManualCrmUpdate[]; }
  async pendingManualCrmUpdate(taskId: string): Promise<ManualCrmUpdate | null> { const row = await this.db.query.manualCrmUpdates.findFirst({ where: and(eq(manualCrmUpdates.taskId, taskId), eq(manualCrmUpdates.status, "pending")) }); return row ? row as ManualCrmUpdate : null; }
  async confirmManualCrmUpdate(taskId: string): Promise<ManualCrmUpdate> {
    const now = new Date(); const rows = await this.db.update(manualCrmUpdates).set({ status: "confirmed", confirmedAt: now }).where(and(eq(manualCrmUpdates.taskId, taskId), eq(manualCrmUpdates.status, "pending"))).returning();
    if (!rows[0]) throw new Error(`No pending manual CRM update for task ${taskId}`);
    await this.event(taskId, "task.crm_manual_update_confirmed", { desiredStatus: rows[0].desiredStatus }, now); return rows[0] as ManualCrmUpdate;
  }

  async changedBetween(from: Date, to: Date): Promise<Task[]> {
    return await this.db.select().from(tasks).where(and(gte(tasks.updatedAt, from), lt(tasks.updatedAt, to))).orderBy(asc(tasks.updatedAt)) as Task[];
  }
  async completedBetween(from: Date, to: Date): Promise<Task[]> {
    return await this.db.select().from(tasks).where(and(gte(tasks.completedAt, from), lt(tasks.completedAt, to))).orderBy(asc(tasks.completedAt)) as Task[];
  }

  private async event(taskId: string, type: string, data: Record<string, unknown>, occurredAt = new Date()) {
    await this.db.insert(taskEvents).values({ id: randomUUID(), taskId, type, data, occurredAt });
  }
}
