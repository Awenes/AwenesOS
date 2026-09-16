import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";

async function fixture() {
  const opened = await openDatabase(":memory:");
  const projects = new ProjectRepository(opened.db);
  const tasks = new TaskRepository(opened.db);
  const project = await projects.create({ name: "App", repositoryRoot: "C:\\app", defaultBranch: "main", completionPolicy: "manual" });
  const task = await tasks.create({ title: "Improve navigation", source: "manual", assignedToMe: true });
  await tasks.assignProject(task.id, project.id);
  const workflows = new WorkflowRepository(opened.db);
  const run = await workflows.create(task.id, project.id);
  return { opened, projects, tasks, project, task, workflows, run };
}

describe("workflow lifecycle", () => {
  it("versions plans and records approval decisions", async () => {
    const value = await fixture();
    const first = await value.workflows.createPlan(value.run.id, "Inspect the current navigation.");
    expect(first).toMatchObject({ version: 1, status: "awaiting_approval" });
    await value.workflows.decidePlan(first.id, "changes_requested");
    const second = await value.workflows.createPlan(value.run.id, "Inspect, implement, and test.");
    await value.workflows.decidePlan(second.id, "approved");
    expect(await value.workflows.plans(value.run.id)).toMatchObject([
      { version: 2, status: "approved" },
      { version: 1, status: "changes_requested" },
    ]);
    expect((await value.workflows.history(value.run.id)).map((event) => event.type)).toContain("plan.approved");
    value.opened.client.close();
  });

  it("tracks required developer interventions", async () => {
    const value = await fixture();
    const intervention = await value.workflows.openIntervention(value.run.id, "permission", "Permission needed", "Allow localhost access.");
    expect(await value.workflows.interventions(value.run.id, true)).toHaveLength(1);
    await value.workflows.resolveIntervention(intervention.id);
    expect(await value.workflows.interventions(value.run.id, true)).toHaveLength(0);
    value.opened.client.close();
  });

  it("prevents two owners from executing the same run", async () => {
    const value = await fixture();
    const now = new Date("2026-09-14T10:00:00Z");
    expect(await value.workflows.acquireLease(value.run.id, "desktop-a", 5_000, now)).toBe(true);
    expect(await value.workflows.acquireLease(value.run.id, "desktop-b", 5_000, now)).toBe(false);
    expect(await value.workflows.releaseLease(value.run.id, "desktop-b", now)).toBe(false);
    expect(await value.workflows.releaseLease(value.run.id, "desktop-a", now)).toBe(true);
    value.opened.client.close();
  });

  it("archives reversibly and logically deletes with a tombstone", async () => {
    const value = await fixture();
    await value.tasks.archive(value.task.id);
    expect(await value.tasks.list()).toHaveLength(0);
    expect(await value.tasks.archived()).toHaveLength(1);
    await value.tasks.restore(value.task.id);
    expect(await value.tasks.list()).toHaveLength(1);
    await value.tasks.delete(value.task.id);
    expect(await value.tasks.list()).toHaveLength(0);
    expect(await value.tasks.archived()).toHaveLength(0);
    expect((await value.tasks.get(value.task.id)).deletedAt).toBeInstanceOf(Date);
    value.opened.client.close();
  });

  it("archives, restores, and logically deletes terminal workflow runs", async () => {
    const value = await fixture();
    await expect(value.workflows.archive(value.run.id)).rejects.toThrow(
      "Cancel or finish",
    );
    await value.workflows.setState(value.run.id, "cancelled", null);
    await value.workflows.archive(value.run.id);
    expect(await value.workflows.list()).toHaveLength(0);
    expect(await value.workflows.archived()).toHaveLength(1);
    await value.workflows.restore(value.run.id);
    expect(await value.workflows.list()).toHaveLength(1);
    await value.workflows.delete(value.run.id);
    expect(await value.workflows.list()).toHaveLength(0);
    expect(await value.workflows.archived()).toHaveLength(0);
    expect((await value.workflows.get(value.run.id)).deletedAt).toBeInstanceOf(
      Date,
    );
    expect(
      (await value.workflows.history(value.run.id)).map((event) => event.type),
    ).toEqual(
      expect.arrayContaining([
        "workflow.archived",
        "workflow.restored",
        "workflow.deleted",
      ]),
    );
    value.opened.client.close();
  });
});
