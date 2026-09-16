import { describe, expect, it } from "vitest";
import { NotificationService } from "../src/application/notification-service.js";
import { TaskService } from "../src/application/task-service.js";
import type { CrmTaskAdapter } from "../src/domain/crm.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";

describe("notification centre", () => {
  it("does not surface legacy CRM synchronization failures", async () => {
    const opened = await openDatabase(":memory:");
    const repository = new TaskRepository(opened.db);
    const crm: CrmTaskAdapter = {
      name: "failing",
      async createTask() {
        return { externalTaskId: "x" };
      },
      async updateExecutionStatus() {},
      async completeTask() {
        throw new Error("CRM offline");
      },
    };
    const tasks = new TaskService(repository, crm);
    const centre = new NotificationService(repository);
    const task = await tasks.capture({
      title: "Notify failed sync",
      source: "manual",
      assignmentDescription: "",
      assignedToMe: false,
      occurredAt: new Date("2026-09-03T08:00:00Z"),
    });
    await tasks.claim(task.id);
    await tasks.mapToCrm(task.id, "p");
    await tasks.start(task.id);
    await tasks.prepareCompletion(task.id, "Done");
    await expect(tasks.complete(task.id)).rejects.toThrow("sync_pending");
    const now = new Date("2026-09-03T10:00:00Z");
    expect(await centre.list(now)).toHaveLength(0);
    opened.client.close();
  });
  it("accepts friendly snooze durations", async () => {
    const opened = await openDatabase(":memory:");
    const repository = new TaskRepository(opened.db);
    const task = await repository.create({
      title: "Friendly snooze",
      source: "manual",
      assignmentDescription: "",
      assignedToMe: false,
      occurredAt: new Date(),
    });
    await repository.transition(task.id, "captured", "planned", "task.claimed");
    await repository.transition(
      task.id,
      "planned",
      "in_progress",
      "task.started",
    );
    await repository.setCompletion(task.id, "Done");
    await repository.transition(
      task.id,
      "in_progress",
      "ready_to_complete",
      "task.completion_prepared",
    );
    const centre = new NotificationService(repository);
    const now = new Date();
    const item = (await centre.list(now))[0]!;
    const preference = await centre.snoozeFor(item.key, "30m", now);
    expect(preference.snoozedUntil?.getTime()).toBe(
      now.getTime() + 30 * 60_000,
    );
    await expect(centre.snoozeFor(item.key, "later", now)).rejects.toThrow(
      "30m",
    );
    opened.client.close();
  });
  it("dismisses one notification occurrence and records the action", async () => {
    const opened = await openDatabase(":memory:");
    const repository = new TaskRepository(opened.db);
    const task = await repository.create({
      title: "Ready",
      source: "manual",
      assignmentDescription: "",
      assignedToMe: false,
      occurredAt: new Date(),
    });
    await repository.transition(task.id, "captured", "planned", "task.claimed");
    await repository.transition(
      task.id,
      "planned",
      "in_progress",
      "task.started",
    );
    await repository.setCompletion(task.id, "Done");
    await repository.transition(
      task.id,
      "in_progress",
      "ready_to_complete",
      "task.completion_prepared",
    );
    const centre = new NotificationService(repository);
    const item = (await centre.list())[0]!;
    await centre.dismiss(item.key);
    expect(await centre.list()).toHaveLength(0);
    expect(
      (await repository.history(task.id)).map((event) => event.type),
    ).toContain("task.notification_dismissed");
    opened.client.close();
  });
  it("notifies when an agent run needs approval and when it completes", async () => {
    const opened = await openDatabase(":memory:");
    const tasks = new TaskRepository(opened.db);
    const projects = new ProjectRepository(opened.db);
    const workflows = new WorkflowRepository(opened.db);
    const project = await projects.create({
      name: "App",
      repositoryRoot: "C:\\app",
      defaultBranch: "main",
      completionPolicy: "manual",
    });
    const task = await tasks.create({
      title: "Ship feature",
      source: "manual",
      assignmentDescription: "",
      assignedToMe: true,
      occurredAt: new Date(),
    });
    await tasks.assignProject(task.id, project.id);
    await tasks.transition(task.id, "assigned", "planned", "task.claimed");
    await tasks.transition(task.id, "planned", "in_progress", "task.started");
    const run = await workflows.create(task.id, project.id);
    await workflows.requestApproval(run.id, "start", "Review instructions");
    await workflows.setState(run.id, "awaiting_approval", null);
    const centre = new NotificationService(tasks, workflows);
    expect(await centre.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "workflow_approval_pending",
          title: "Agent run ready for approval",
        }),
      ]),
    );
    await workflows.setState(run.id, "failed", "plan", "Provider failed");
    expect(await centre.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "workflow_failed" }),
      ]),
    );
    expect(await centre.list()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "workflow_approval_pending" }),
      ]),
    );
    await workflows.setState(run.id, "completed", null);
    const completedNotifications = await centre.list();
    expect(completedNotifications.map((item) => item.detail).join(" ")).not.toContain("—");
    expect(completedNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "workflow_completed",
          suggestedAction: "Open task review",
        }),
      ]),
    );
    await tasks.setCompletion(task.id, "Reviewed evidence");
    await tasks.transition(task.id, "in_progress", "ready_to_complete", "task.completion_prepared");
    expect(await centre.list()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "workflow_completed" })]),
    );
    expect(await centre.list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "completion_ready" })]),
    );
    opened.client.close();
  });
});
