import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type {
  CaptureTask,
  EvidenceKind,
  Task,
  TaskStatus,
} from "../../domain/task.js";
import type { NotificationPreference } from "../../domain/notification.js";
import type { Database } from "../db/database.js";
import {
  evidence,
  notificationPreferences,
  taskEvents,
  taskRepositories,
  tasks,
  taskTombstones,
} from "../db/schema.js";

export interface TaskRepositoryMapping {
  taskId: string;
  repositoryRoot: string;
  branchAtMapping: string;
  headAtMapping: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskRepository {
  constructor(private readonly db: Database) {}

  async create(input: CaptureTask): Promise<Task> {
    const now = input.occurredAt ?? new Date();
    const task: Task = {
      id: randomUUID(),
      projectId: null,
      title: input.title,
      source: input.source,
      sourceReference: input.sourceReference ?? null,
      assignmentDescription: input.assignmentDescription ?? "",
      completionDescription: null,
      status: input.assignedToMe ? "assigned" : "captured",
      assignedToMe: input.assignedToMe ?? false,
      syncError: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      archivedAt: null,
      deletedAt: null,
    };
    await this.db.insert(tasks).values(task);
    await this.event(
      task.id,
      "task.captured",
      { source: task.source, assignedToMe: task.assignedToMe },
      now,
    );
    return task;
  }

  async get(id: string): Promise<Task> {
    const row = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });
    if (!row) throw new Error(`Task not found: ${id}`);
    return row as Task;
  }

  async list(statuses?: TaskStatus[]): Promise<Task[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          isNull(tasks.archivedAt),
          isNull(tasks.deletedAt),
          statuses?.length ? inArray(tasks.status, statuses) : undefined,
        ),
      )
      .orderBy(desc(tasks.updatedAt));
    return rows as Task[];
  }

  async listForProject(projectId: string): Promise<Task[]> {
    return (await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          isNull(tasks.archivedAt),
          isNull(tasks.deletedAt),
        ),
      )
      .orderBy(desc(tasks.updatedAt))) as Task[];
  }

  async archived(): Promise<Task[]> {
    return (await this.db
      .select()
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), isNotNull(tasks.archivedAt)))
      .orderBy(desc(tasks.archivedAt))) as Task[];
  }

  async archive(id: string): Promise<Task> {
    const task = await this.get(id);
    if (["in_progress", "sync_pending"].includes(task.status))
      throw new Error(
        "Active work must be paused or finished before it can be archived",
      );
    if (task.deletedAt) throw new Error("A deleted task cannot be archived");
    if (task.archivedAt) return task;
    const now = new Date();
    await this.db
      .update(tasks)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(tasks.id, id));
    await this.event(id, "task.archived", {}, now);
    return this.get(id);
  }

  async restore(id: string): Promise<Task> {
    const task = await this.get(id);
    if (task.deletedAt) throw new Error("A deleted task cannot be restored");
    if (!task.archivedAt) return task;
    const now = new Date();
    await this.db
      .update(tasks)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(tasks.id, id));
    await this.event(id, "task.restored", {}, now);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const task = await this.get(id);
    if (["in_progress", "sync_pending"].includes(task.status))
      throw new Error(
        "Active work must be paused or finished before it can be deleted",
      );
    if (task.deletedAt) return;
    const now = new Date();
    await this.db
      .update(tasks)
      .set({ deletedAt: now, archivedAt: null, updatedAt: now })
      .where(eq(tasks.id, id));
    await this.db
      .insert(taskTombstones)
      .values({ taskId: id, deletedAt: now })
      .onConflictDoNothing();
    await this.event(id, "task.deleted", {}, now);
  }

  async findBySourceReference(sourceReference: string): Promise<Task | null> {
    const row = await this.db.query.tasks.findFirst({
      where: eq(tasks.sourceReference, sourceReference),
    });
    return row ? (row as Task) : null;
  }

  async assignProject(taskId: string, projectId: string): Promise<Task> {
    const task = await this.get(taskId);
    const now = new Date();
    await this.db
      .update(tasks)
      .set({ projectId, updatedAt: now })
      .where(eq(tasks.id, taskId));
    await this.event(
      taskId,
      task.projectId ? "task.project_reassigned" : "task.project_assigned",
      { from: task.projectId, to: projectId },
      now,
    );
    return this.get(taskId);
  }

  async transition(
    id: string,
    from: TaskStatus,
    to: TaskStatus,
    eventType: string,
    data: Record<string, unknown> = {},
  ): Promise<Task> {
    const now = new Date();
    const changed = await this.db
      .update(tasks)
      .set({ status: to, updatedAt: now, syncError: null })
      .where(and(eq(tasks.id, id), eq(tasks.status, from)))
      .returning();
    if (!changed[0])
      throw new Error(`Task ${id} is no longer ${from}; refresh and try again`);
    await this.event(id, eventType, { from, to, ...data }, now);
    return changed[0] as Task;
  }

  async setCompletion(id: string, description: string): Promise<void> {
    await this.db
      .update(tasks)
      .set({ completionDescription: description, updatedAt: new Date() })
      .where(eq(tasks.id, id));
    await this.event(id, "task.completion_description_updated", {
      description,
    });
  }

  async markCompleted(
    id: string,
    now = new Date(),
    eventType = "task.completed",
  ): Promise<Task> {
    await this.db
      .update(tasks)
      .set({
        status: "completed",
        completedAt: now,
        updatedAt: now,
        syncError: null,
      })
      .where(eq(tasks.id, id));
    await this.event(id, eventType, {}, now);
    return this.get(id);
  }

  async addEvidence(
    taskId: string,
    kind: EvidenceKind,
    value: string,
  ): Promise<void> {
    await this.db
      .insert(evidence)
      .values({ id: randomUUID(), taskId, kind, value, createdAt: new Date() });
    await this.event(taskId, "task.evidence_added", { kind, value });
  }

  async evidenceFor(taskId: string) {
    return this.db
      .select()
      .from(evidence)
      .where(eq(evidence.taskId, taskId))
      .orderBy(asc(evidence.createdAt));
  }
  async hasEvidence(
    taskId: string,
    kind: EvidenceKind,
    value: string,
  ): Promise<boolean> {
    return Boolean(
      await this.db.query.evidence.findFirst({
        where: and(
          eq(evidence.taskId, taskId),
          eq(evidence.kind, kind),
          eq(evidence.value, value),
        ),
      }),
    );
  }
  async history(taskId: string) {
    return this.db
      .select()
      .from(taskEvents)
      .where(eq(taskEvents.taskId, taskId))
      .orderBy(asc(taskEvents.occurredAt));
  }

  async saveRepositoryMapping(
    mapping: Omit<TaskRepositoryMapping, "createdAt" | "updatedAt">,
  ): Promise<TaskRepositoryMapping> {
    const now = new Date();
    const existing = await this.repositoryMapping(mapping.taskId);
    await this.db
      .insert(taskRepositories)
      .values({
        id: randomUUID(),
        ...mapping,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: taskRepositories.taskId,
        set: {
          repositoryRoot: mapping.repositoryRoot,
          branchAtMapping: mapping.branchAtMapping,
          headAtMapping: mapping.headAtMapping,
          updatedAt: now,
        },
      });
    await this.event(
      mapping.taskId,
      existing ? "task.repository_remapped" : "task.repository_mapped",
      {
        repositoryRoot: mapping.repositoryRoot,
        branchAtMapping: mapping.branchAtMapping,
        headAtMapping: mapping.headAtMapping,
      },
      now,
    );
    return (await this.repositoryMapping(mapping.taskId))!;
  }

  async repositoryMapping(
    taskId: string,
  ): Promise<TaskRepositoryMapping | null> {
    const row = await this.db.query.taskRepositories.findFirst({
      where: eq(taskRepositories.taskId, taskId),
    });
    return row ? (row as TaskRepositoryMapping) : null;
  }
  async notificationPreferences(): Promise<NotificationPreference[]> {
    return (await this.db
      .select()
      .from(notificationPreferences)) as NotificationPreference[];
  }
  async saveNotificationPreference(
    preference: NotificationPreference,
    eventType: string,
  ): Promise<NotificationPreference> {
    await this.db
      .insert(notificationPreferences)
      .values(preference)
      .onConflictDoUpdate({
        target: notificationPreferences.notificationKey,
        set: {
          dismissedAt: preference.dismissedAt,
          snoozedUntil: preference.snoozedUntil,
          updatedAt: preference.updatedAt,
        },
      });
    await this.event(
      preference.taskId,
      eventType,
      {
        notificationKey: preference.notificationKey,
        snoozedUntil: preference.snoozedUntil?.toISOString() ?? null,
      },
      preference.updatedAt,
    );
    return preference;
  }

  async changedBetween(from: Date, to: Date): Promise<Task[]> {
    return (await this.db
      .select()
      .from(tasks)
      .where(and(gte(tasks.updatedAt, from), lt(tasks.updatedAt, to)))
      .orderBy(asc(tasks.updatedAt))) as Task[];
  }
  async completedBetween(from: Date, to: Date): Promise<Task[]> {
    return (await this.db
      .select()
      .from(tasks)
      .where(and(gte(tasks.completedAt, from), lt(tasks.completedAt, to)))
      .orderBy(asc(tasks.completedAt))) as Task[];
  }

  private async event(
    taskId: string,
    type: string,
    data: Record<string, unknown>,
    occurredAt = new Date(),
  ) {
    await this.db
      .insert(taskEvents)
      .values({ id: randomUUID(), taskId, type, data, occurredAt });
  }
}
