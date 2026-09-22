import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type {
  Approval,
  ApprovalKind,
  WorkflowRun,
  WorkflowStage,
  WorkflowStep,
  WorkflowPlan,
  WorkflowIntervention,
  InterventionKind,
} from "../../domain/workflow.js";
import type { Database } from "../db/database.js";
import {
  workflowApprovals,
  workflowEvents,
  workflowInterventions,
  workflowPlans,
  workflowRuns,
  workflowRunTombstones,
  workflowSteps,
} from "../db/schema.js";

// Safety valve so a long-running local install can't hand the renderer/CLI an
// unbounded result set.
const MAX_LIST_ROWS = 2_000;

export class WorkflowRepository {
  constructor(private readonly db: Database) {}
  async create(taskId: string, projectId: string) {
    const now = new Date();
    const run: WorkflowRun = {
      id: randomUUID(),
      taskId,
      projectId,
      status: "created",
      currentStage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      archivedAt: null,
      deletedAt: null,
    };
    await this.db.batch([
      this.db.insert(workflowRuns).values(run),
      this.db
        .insert(workflowEvents)
        .values({ id: randomUUID(), runId: run.id, type: "workflow.created", data: {}, occurredAt: now }),
    ]);
    return run;
  }
  async get(id: string) {
    const row = await this.db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, id),
    });
    if (!row) throw new Error(`Workflow run not found: ${id}`);
    return row as WorkflowRun;
  }
  async list(): Promise<WorkflowRun[]> {
    return (await this.db
      .select()
      .from(workflowRuns)
      .where(and(isNull(workflowRuns.archivedAt), isNull(workflowRuns.deletedAt)))
      .orderBy(asc(workflowRuns.createdAt))
      .limit(MAX_LIST_ROWS)) as WorkflowRun[];
  }
  async archived(): Promise<WorkflowRun[]> {
    return (await this.db
      .select()
      .from(workflowRuns)
      .where(and(isNotNull(workflowRuns.archivedAt), isNull(workflowRuns.deletedAt)))
      .orderBy(desc(workflowRuns.archivedAt))
      .limit(MAX_LIST_ROWS)) as WorkflowRun[];
  }
  async archive(id: string) {
    const run = await this.get(id);
    if (["created", "running", "awaiting_approval", "paused"].includes(run.status))
      throw new Error("Cancel or finish this run before archiving it");
    if (run.deletedAt) throw new Error("A deleted run cannot be archived");
    if (run.archivedAt) return run;
    const now = new Date();
    await this.db.update(workflowRuns).set({ archivedAt: now, updatedAt: now }).where(eq(workflowRuns.id, id));
    await this.event(id, "workflow.archived", {}, now);
    return this.get(id);
  }
  async restore(id: string) {
    const run = await this.get(id);
    if (run.deletedAt) throw new Error("A deleted run cannot be restored");
    if (!run.archivedAt) return run;
    const now = new Date();
    await this.db.update(workflowRuns).set({ archivedAt: null, updatedAt: now }).where(eq(workflowRuns.id, id));
    await this.event(id, "workflow.restored", {}, now);
    return this.get(id);
  }
  async delete(id: string) {
    const run = await this.get(id);
    if (["created", "running", "awaiting_approval", "paused"].includes(run.status))
      throw new Error("Cancel or finish this run before deleting it");
    if (run.deletedAt) return;
    const now = new Date();
    await this.db.batch([
      this.db.update(workflowRuns).set({ deletedAt: now, archivedAt: null, updatedAt: now }).where(eq(workflowRuns.id, id)),
      this.db.insert(workflowRunTombstones).values({ runId: id, deletedAt: now }).onConflictDoNothing(),
      this.db
        .insert(workflowEvents)
        .values({ id: randomUUID(), runId: id, type: "workflow.deleted", data: {}, occurredAt: now }),
    ]);
  }
  async setState(
    id: string,
    status: WorkflowRun["status"],
    stage: WorkflowStage | null,
    error: string | null = null,
  ) {
    const current = await this.get(id);
    const now = new Date();
    await this.db.batch([
      this.db
        .update(workflowRuns)
        .set({
          status,
          currentStage: stage,
          error,
          updatedAt: now,
          startedAt: status === "running" && !current.startedAt ? now : undefined,
          completedAt: status === "completed" ? now : undefined,
        })
        .where(eq(workflowRuns.id, id)),
      this.db
        .insert(workflowEvents)
        .values({ id: randomUUID(), runId: id, type: `workflow.${status}`, data: { stage, error }, occurredAt: now }),
    ]);
    return this.get(id);
  }
  async addStep(
    runId: string,
    ordinal: number,
    stage: WorkflowStage,
    roleId: string | null,
    instructionSnapshot: Record<string, unknown> | null,
  ) {
    const step: WorkflowStep = {
      id: randomUUID(),
      runId,
      ordinal,
      stage,
      roleId,
      status: "pending",
      attempt: 0,
      instructionSnapshot,
      output: null,
      startedAt: null,
      completedAt: null,
    };
    await this.db.insert(workflowSteps).values(step);
    return step;
  }
  async steps(runId: string): Promise<WorkflowStep[]> {
    return (await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.runId, runId))
      .orderBy(asc(workflowSteps.ordinal))) as WorkflowStep[];
  }
  async startStep(id: string) {
    await this.db
      .update(workflowSteps)
      .set({
        status: "running",
        startedAt: new Date(),
        attempt: sql`${workflowSteps.attempt} + 1`,
      })
      .where(eq(workflowSteps.id, id));
  }
  async finishStep(id: string, passed: boolean, output: string) {
    const row = await this.db.query.workflowSteps.findFirst({
      where: eq(workflowSteps.id, id),
    });
    if (!row) throw new Error(`Workflow step not found: ${id}`);
    const now = new Date();
    await this.db
      .update(workflowSteps)
      .set({ status: passed ? "passed" : "failed", output, completedAt: now })
      .where(eq(workflowSteps.id, id));
    await this.event(
      row.runId,
      passed ? "step.passed" : "step.failed",
      { stepId: id, stage: row.stage, attempt: row.attempt + 1 },
      now,
    );
  }
  async completeStage(runId: string, stage: WorkflowStage, output: string) {
    const row = await this.db.query.workflowSteps.findFirst({
      where: and(
        eq(workflowSteps.runId, runId),
        eq(workflowSteps.stage, stage),
      ),
    });
    if (!row) throw new Error(`Workflow ${stage} step not found`);
    if (row.status === "passed") return row as WorkflowStep;
    const now = new Date();
    await this.db
      .update(workflowSteps)
      .set({
        status: "passed",
        output,
        attempt: row.attempt + 1,
        startedAt: row.startedAt ?? now,
        completedAt: now,
      })
      .where(eq(workflowSteps.id, row.id));
    await this.event(
      runId,
      "step.passed",
      { stepId: row.id, stage, attempt: row.attempt + 1 },
      now,
    );
    return (await this.steps(runId)).find((step) => step.id === row.id)!;
  }
  async requestApproval(runId: string, kind: ApprovalKind, detail: string) {
    const value: Approval = {
      id: randomUUID(),
      runId,
      kind,
      status: "pending",
      detail,
      requestedAt: new Date(),
      decidedAt: null,
    };
    await this.db.insert(workflowApprovals).values(value);
    await this.event(
      runId,
      "approval.requested",
      { approvalId: value.id, kind },
      value.requestedAt,
    );
    return value;
  }
  async approvals(runId: string): Promise<Approval[]> {
    return (await this.db
      .select()
      .from(workflowApprovals)
      .where(eq(workflowApprovals.runId, runId))
      .orderBy(asc(workflowApprovals.requestedAt))) as Approval[];
  }
  async createPlan(runId: string, content: string, requiresApproval = true) {
    await this.get(runId);
    const latest = await this.db
      .select()
      .from(workflowPlans)
      .where(eq(workflowPlans.runId, runId))
      .orderBy(desc(workflowPlans.version))
      .limit(1);
    const now = new Date();
    const plan: WorkflowPlan = {
      id: randomUUID(),
      runId,
      version: (latest[0]?.version ?? 0) + 1,
      content: content.trim(),
      status: requiresApproval ? "awaiting_approval" : "approved",
      createdAt: now,
      decidedAt: requiresApproval ? null : now,
    };
    if (!plan.content) throw new Error("A workflow plan cannot be empty");
    await this.db.insert(workflowPlans).values(plan);
    await this.event(runId, "plan.created", { planId: plan.id, version: plan.version, status: plan.status }, now);
    return plan;
  }
  plans(runId: string): Promise<WorkflowPlan[]> {
    return this.db.select().from(workflowPlans).where(eq(workflowPlans.runId, runId)).orderBy(desc(workflowPlans.version)) as Promise<WorkflowPlan[]>;
  }
  async decidePlan(id: string, decision: "approved" | "changes_requested") {
    const current = await this.db.query.workflowPlans.findFirst({ where: eq(workflowPlans.id, id) });
    if (!current || current.status !== "awaiting_approval") throw new Error("Plan awaiting approval not found");
    const decidedAt = new Date();
    await this.db.update(workflowPlans).set({ status: decision, decidedAt }).where(eq(workflowPlans.id, id));
    await this.event(current.runId, `plan.${decision}`, { planId: id, version: current.version }, decidedAt);
    return { ...current, status: decision, decidedAt } as WorkflowPlan;
  }
  async openIntervention(runId: string, kind: InterventionKind, title: string, detail: string) {
    await this.get(runId);
    const now = new Date();
    const intervention: WorkflowIntervention = { id: randomUUID(), runId, kind, title: title.trim(), detail: detail.trim(), status: "open", createdAt: now, resolvedAt: null };
    if (!intervention.title || !intervention.detail) throw new Error("An intervention needs a title and detail");
    await this.db.insert(workflowInterventions).values(intervention);
    await this.event(runId, "intervention.opened", { interventionId: intervention.id, kind }, now);
    return intervention;
  }
  interventions(runId: string, openOnly = false): Promise<WorkflowIntervention[]> {
    return this.db.select().from(workflowInterventions).where(and(eq(workflowInterventions.runId, runId), openOnly ? eq(workflowInterventions.status, "open") : undefined)).orderBy(asc(workflowInterventions.createdAt)) as Promise<WorkflowIntervention[]>;
  }
  async resolveIntervention(id: string) {
    const current = await this.db.query.workflowInterventions.findFirst({ where: eq(workflowInterventions.id, id) });
    if (!current || current.status !== "open") throw new Error("Open intervention not found");
    const resolvedAt = new Date();
    await this.db.update(workflowInterventions).set({ status: "resolved", resolvedAt }).where(eq(workflowInterventions.id, id));
    await this.event(current.runId, "intervention.resolved", { interventionId: id }, resolvedAt);
    return { ...current, status: "resolved", resolvedAt } as WorkflowIntervention;
  }
  async acquireLease(runId: string, owner: string, ttlMs: number, now = new Date()) {
    if (!owner.trim() || ttlMs < 1_000) throw new Error("A lease needs an owner and a duration of at least one second");
    const expiresAt = new Date(now.getTime() + ttlMs);
    const changed = await this.db.update(workflowRuns).set({ leaseOwner: owner, leaseExpiresAt: expiresAt, updatedAt: now }).where(and(eq(workflowRuns.id, runId), or(isNull(workflowRuns.leaseExpiresAt), lt(workflowRuns.leaseExpiresAt, now), eq(workflowRuns.leaseOwner, owner)))).returning();
    if (!changed[0]) return false;
    await this.event(runId, "workflow.lease_acquired", { owner, expiresAt: expiresAt.toISOString() }, now);
    return true;
  }
  async releaseLease(runId: string, owner: string, now = new Date()) {
    const changed = await this.db.update(workflowRuns).set({ leaseOwner: null, leaseExpiresAt: null, updatedAt: now }).where(and(eq(workflowRuns.id, runId), eq(workflowRuns.leaseOwner, owner))).returning();
    if (!changed[0]) return false;
    await this.event(runId, "workflow.lease_released", { owner }, now);
    return true;
  }
  async approval(id: string) {
    const row = await this.db.query.workflowApprovals.findFirst({
      where: eq(workflowApprovals.id, id),
    });
    if (!row) throw new Error(`Workflow approval not found: ${id}`);
    return row as Approval;
  }
  async hasApproved(runId: string, kind: ApprovalKind) {
    const row = await this.db.query.workflowApprovals.findFirst({
      where: and(
        eq(workflowApprovals.runId, runId),
        eq(workflowApprovals.kind, kind),
        eq(workflowApprovals.status, "approved"),
      ),
    });
    return Boolean(row);
  }
  async decide(id: string, approved: boolean) {
    const row = await this.db.query.workflowApprovals.findFirst({
      where: eq(workflowApprovals.id, id),
    });
    if (!row || row.status !== "pending")
      throw new Error("Pending approval not found");
    const decidedAt = new Date(),
      status = approved ? "approved" : "rejected";
    await this.db
      .update(workflowApprovals)
      .set({ status, decidedAt })
      .where(eq(workflowApprovals.id, id));
    await this.event(
      row.runId,
      approved ? "approval.approved" : "approval.rejected",
      { approvalId: id, kind: row.kind },
      decidedAt,
    );
    return {
      run: await this.get(row.runId),
      approval: { ...row, status, decidedAt } as Approval,
    };
  }
  history(runId: string) {
    return this.db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.runId, runId))
      .orderBy(asc(workflowEvents.occurredAt));
  }
  async recoverInterrupted() {
    const interrupted = await this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.status, "running"));
    if (!interrupted.length) return 0;
    const interruptedIds = interrupted.map((run) => run.id);
    const activeSteps = await this.db
      .select()
      .from(workflowSteps)
      .where(
        and(
          inArray(workflowSteps.runId, interruptedIds),
          eq(workflowSteps.status, "running"),
        ),
      );
    if (!activeSteps.length) return 0;
    const runIdsToRecover = [...new Set(activeSteps.map((step) => step.runId))];
    const now = new Date();
    await this.db
      .update(workflowSteps)
      .set({
        status: "failed",
        output: "Awenes stopped before this step finished.",
        completedAt: now,
      })
      .where(
        and(
          inArray(workflowSteps.runId, runIdsToRecover),
          eq(workflowSteps.status, "running"),
        ),
      );
    await this.db
      .update(workflowRuns)
      .set({
        status: "paused",
        error: "Recovered after an interrupted application session",
        updatedAt: now,
      })
      .where(inArray(workflowRuns.id, runIdsToRecover));
    await this.db.insert(workflowEvents).values(
      runIdsToRecover.map((runId) => ({
        id: randomUUID(),
        runId,
        type: "workflow.recovered",
        data: { previousStatus: "running" },
        occurredAt: now,
      })),
    );
    return runIdsToRecover.length;
  }
  private event(
    runId: string,
    type: string,
    data: Record<string, unknown>,
    occurredAt = new Date(),
  ) {
    return this.db
      .insert(workflowEvents)
      .values({ id: randomUUID(), runId, type, data, occurredAt });
  }
}
