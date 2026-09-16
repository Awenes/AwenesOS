import type { CrmCoordinationMode, CrmTaskAdapter } from "../domain/crm.js";
import {
  assertTransition,
  CaptureTaskSchema,
  EvidenceKindSchema,
  type CaptureTask,
  type Task,
  type TaskStatus,
} from "../domain/task.js";
import { TaskRepository } from "../infrastructure/repositories/task-repository.js";
import type {
  GitEvidenceCollector,
  GitRepositoryInspector,
} from "../domain/git-evidence.js";
import { draftCompletionDescription } from "./completion-draft.js";
import { ReportingService } from "./reporting-service.js";
import {
  calculateTaskDuration,
  formatDuration,
} from "../domain/task-duration.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly crm: CrmTaskAdapter,
    private readonly crmMode: CrmCoordinationMode = "automatic",
  ) {}

  capture(input: CaptureTask) {
    return this.repository.create(CaptureTaskSchema.parse(input));
  }
  inbox() {
    return this.repository.list(["captured", "assigned"]);
  }
  queue() {
    return this.repository.list([
      "planned",
      "in_progress",
      "paused",
      "ready_to_complete",
      "sync_pending",
    ]);
  }
  allTasks() {
    return this.repository.list();
  }
  archivedTasks() {
    return this.repository.archived();
  }
  archive(id: string) {
    return this.repository.archive(id);
  }
  restore(id: string) {
    return this.repository.restore(id);
  }
  delete(id: string) {
    return this.repository.delete(id);
  }
  history(id: string) {
    return this.repository.history(id);
  }

  async assignProject(
    id: string,
    projectId: string,
    projects: ProjectRepository,
  ) {
    await projects.get(projectId);
    return this.repository.assignProject(id, projectId);
  }

  tasksForProject(projectId: string) {
    return this.repository.listForProject(projectId);
  }

  async confirm(id: string) {
    return this.move(id, "assigned", "task.confirmed");
  }
  async claim(id: string) {
    const task = await this.repository.get(id);
    if (task.status !== "captured" && task.status !== "assigned")
      throw new Error(
        `Only inbox tasks can be claimed; task is ${task.status}`,
      );
    assertTransition(task.status, "planned");
    return this.repository.transition(
      id,
      task.status,
      "planned",
      "task.claimed",
    );
  }
  async reject(id: string) {
    return this.move(id, "rejected", "task.rejected");
  }

  async mapToCrm(
    id: string,
    projectId: string,
    externalTaskId?: string,
    externalUrl?: string,
  ) {
    const task = await this.repository.get(id);
    if (this.crmMode === "manual" && !externalTaskId?.trim())
      throw new Error(
        "Manual CRM mode requires an existing CRM task ID or reference",
      );
    const external = externalTaskId
      ? {
          externalTaskId,
          ...(externalUrl?.trim() ? { externalUrl: externalUrl.trim() } : {}),
        }
      : await this.crm.createTask({
          projectId,
          title: task.title,
          description: task.assignmentDescription,
        });
    await this.repository.saveMapping({
      taskId: id,
      adapter: this.crm.name,
      projectId,
      externalTaskId: external.externalTaskId,
      externalUrl:
        "externalUrl" in external ? (external.externalUrl ?? null) : null,
    });
    return external;
  }

  async start(id: string) {
    return this.syncExecution(id, "in_progress", "task.started");
  }
  async pause(id: string) {
    return this.syncExecution(id, "paused", "task.paused");
  }
  async resume(id: string) {
    return this.syncExecution(id, "in_progress", "task.resumed");
  }

  async addEvidence(id: string, kind: string, value: string) {
    await this.repository.get(id);
    await this.repository.addEvidence(
      id,
      EvidenceKindSchema.parse(kind),
      value.trim(),
    );
  }

  async attachRepository(
    id: string,
    repositoryPath: string,
    inspector: GitRepositoryInspector,
  ) {
    const task = await this.repository.get(id);
    if (!["planned", "in_progress", "paused"].includes(task.status))
      throw new Error(
        `A repository can only be attached to planned or active work; task is ${task.status}`,
      );
    const identity = await inspector.inspect(repositoryPath);
    return this.repository.saveRepositoryMapping({
      taskId: id,
      repositoryRoot: identity.repository,
      branchAtMapping: identity.branch,
      headAtMapping: identity.head,
    });
  }

  repositoryMapping(id: string) {
    return this.repository.repositoryMapping(id);
  }

  async collectGitEvidence(
    id: string,
    repositoryPath: string | undefined,
    collector: GitEvidenceCollector,
  ) {
    const task = await this.repository.get(id);
    if (task.status !== "in_progress" && task.status !== "paused")
      throw new Error(
        `Git evidence can only be collected for active or paused work; task is ${task.status}`,
      );
    const history = await this.repository.history(id);
    const started = history.find((event) => event.type === "task.started");
    if (!started) throw new Error("Task has no recorded start time");
    const mapped = await this.repository.repositoryMapping(id);
    const selectedRepository = repositoryPath?.trim() || mapped?.repositoryRoot;
    if (!selectedRepository)
      throw new Error("No Git repository is attached to this task");
    const collected = await collector.collect({
      repositoryPath: selectedRepository,
      since: started.occurredAt,
    });
    let added = 0;
    let skippedExisting = 0;
    const items = [
      ...collected.commits.map((value) => ({ kind: "commit" as const, value })),
      ...collected.files.map((value) => ({
        kind: "file" as const,
        value: `${collected.repository}: ${value}`,
      })),
    ];
    for (const item of items) {
      if (await this.repository.hasEvidence(id, item.kind, item.value)) {
        skippedExisting += 1;
        continue;
      }
      await this.repository.addEvidence(id, item.kind, item.value);
      added += 1;
    }
    return {
      repository: collected.repository,
      branch: collected.branch,
      commits: collected.commits.length,
      files: collected.files.length,
      added,
      skippedExisting,
    };
  }

  async prepareCompletion(id: string, note?: string): Promise<string> {
    const task = await this.repository.get(id);
    if (task.status !== "in_progress" && task.status !== "paused")
      throw new Error(`Task must be active or paused; task is ${task.status}`);
    const description = note?.trim() || (await this.draftCompletion(id));
    await this.repository.setCompletion(id, description);
    await this.repository.transition(
      id,
      task.status,
      "ready_to_complete",
      "task.completion_prepared",
    );
    return description;
  }

  async draftCompletion(id: string): Promise<string> {
    const task = await this.repository.get(id);
    if (task.status !== "in_progress" && task.status !== "paused")
      throw new Error(
        `A completion draft can only be generated for active or paused work; task is ${task.status}`,
      );
    return draftCompletionDescription(
      task,
      await this.repository.evidenceFor(id),
      await this.repository.repositoryMapping(id),
    );
  }

  async editCompletion(id: string, description: string) {
    const task = await this.repository.get(id);
    if (task.status !== "ready_to_complete" && task.status !== "sync_pending")
      throw new Error(
        "Completion description can only be edited during completion",
      );
    await this.repository.setCompletion(id, description.trim());
  }

  async complete(id: string): Promise<Task> {
    let task = await this.repository.get(id);
    if (this.crmMode === "local") {
      if (task.status !== "ready_to_complete")
        throw new Error(
          `Task is not ready to complete; task is ${task.status}`,
        );
      if (!task.completionDescription)
        throw new Error("A completion description is required");
      return this.repository.markCompleted(id, new Date(), "task.completed");
    }
    if (this.crmMode === "manual") {
      if (task.status === "ready_to_complete")
        task = await this.repository.transition(
          id,
          "ready_to_complete",
          "sync_pending",
          "task.crm_manual_completion_pending",
        );
      if (task.status !== "sync_pending")
        throw new Error(
          `Task is not ready for manual CRM confirmation; task is ${task.status}`,
        );
      if (!task.completionDescription)
        throw new Error("A completion description is required");
      const pending = await this.repository.pendingManualCrmUpdate(id);
      if (
        pending?.desiredStatus !== "Completed" ||
        pending.description !== task.completionDescription
      )
        await this.repository.queueManualCrmUpdate(
          id,
          "Completed",
          task.completionDescription,
        );
      return task;
    }
    if (task.status === "ready_to_complete")
      task = await this.repository.transition(
        id,
        "ready_to_complete",
        "sync_pending",
        "task.crm_sync_started",
      );
    if (task.status !== "sync_pending")
      throw new Error(`Task is not ready for CRM sync; task is ${task.status}`);
    if (!task.completionDescription)
      throw new Error("A completion description is required");
    const mapping = await this.requiredMapping(id);
    try {
      await this.crm.completeTask(mapping, {
        assignmentDescription: task.assignmentDescription,
        completionDescription: task.completionDescription,
      });
      const completed = await this.repository.markCompleted(id);
      if (completed.source === "bug-tracker")
        await this.repository.queueTrackerUpdate(completed);
      return completed;
    } catch (error) {
      await this.repository.markSyncFailure(id, errorMessage(error));
      throw new Error(
        `CRM sync failed; task remains sync_pending: ${errorMessage(error)}`,
      );
    }
  }

  pendingTrackerUpdates() {
    return this.repository.pendingTrackerUpdates();
  }
  confirmTrackerUpdate(taskId: string) {
    return this.repository.confirmTrackerUpdate(taskId);
  }
  pendingManualCrmUpdates() {
    return this.repository.pendingManualCrmUpdates();
  }
  async confirmManualCrmUpdate(taskId: string) {
    const update = await this.repository.confirmManualCrmUpdate(taskId);
    let task = await this.repository.get(taskId);
    if (update.desiredStatus === "Completed") {
      task = await this.repository.markCompleted(taskId);
      if (task.source === "bug-tracker")
        await this.repository.queueTrackerUpdate(task);
    }
    return { update, task };
  }
  async duration(id: string, now = new Date()) {
    await this.repository.get(id);
    const duration = calculateTaskDuration(
      await this.repository.history(id),
      now,
    );
    return {
      ...duration,
      active: formatDuration(duration.activeMilliseconds),
      paused: formatDuration(duration.pausedMilliseconds),
      calendar: formatDuration(duration.calendarMilliseconds),
    };
  }
  async taskSummary(id: string, now = new Date()) {
    const task = await this.repository.get(id);
    return {
      task,
      duration: await this.duration(id, now),
      evidence: await this.repository.evidenceFor(id),
      repository: await this.repository.repositoryMapping(id),
    };
  }

  async standup(now = new Date()): Promise<string> {
    return new ReportingService(this.repository).standup(now);
  }

  private async move(id: string, to: TaskStatus, event: string) {
    const task = await this.repository.get(id);
    assertTransition(task.status, to);
    return this.repository.transition(id, task.status, to, event);
  }

  private async syncExecution(
    id: string,
    to: "in_progress" | "paused",
    event: string,
  ) {
    const task = await this.repository.get(id);
    assertTransition(task.status, to);
    if (this.crmMode === "local")
      return this.repository.transition(id, task.status, to, event);
    if (this.crmMode === "manual") {
      const transitioned = await this.repository.transition(
        id,
        task.status,
        to,
        event,
      );
      await this.repository.queueManualCrmUpdate(
        id,
        to === "paused" ? "Paused" : "In Progress",
      );
      return transitioned;
    }
    const mapping = await this.requiredMapping(id);
    await this.crm.updateExecutionStatus(mapping, to);
    return this.repository.transition(id, task.status, to, event);
  }

  private async requiredMapping(id: string) {
    const mapping = await this.repository.mapping(id, this.crm.name);
    if (!mapping)
      throw new Error(
        `Task ${id} is not mapped to the ${this.crm.name} CRM adapter`,
      );
    return mapping;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
