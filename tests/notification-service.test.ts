import { describe, expect, it } from "vitest";
import { NotificationService } from "../src/application/notification-service.js";
import { TaskService } from "../src/application/task-service.js";
import type { CrmTaskAdapter } from "../src/domain/crm.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";

describe("notification centre", () => {
  it("derives, snoozes, and resurfaces an unresolved CRM sync notification", async () => {
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
    const notification = (await centre.list(now))[0]!;
    expect(notification).toMatchObject({
      kind: "crm_sync_failed",
      severity: "critical",
    });
    await centre.snooze(
      notification.key,
      new Date("2026-09-03T11:00:00Z"),
      now,
    );
    expect(await centre.list(new Date("2026-09-03T10:30:00Z"))).toHaveLength(0);
    expect(await centre.list(new Date("2026-09-03T11:01:00Z"))).toHaveLength(1);
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
    const run = await workflows.create(task.id, project.id);
    await workflows.requestApproval(run.id, "start", "Review instructions");
    const centre = new NotificationService(tasks, workflows);
    expect(await centre.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "workflow_approval_pending" }),
      ]),
    );
    await workflows.setState(run.id, "completed", null);
    expect(await centre.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "workflow_completed" }),
      ]),
    );
    opened.client.close();
  });
});
