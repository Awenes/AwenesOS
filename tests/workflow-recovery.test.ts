import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
describe("workflow recovery", () => {
  it("pauses interrupted runs and records recovery instead of silently repairing them", async () => {
    const opened = await openDatabase(":memory:");
    const tasks = new TaskRepository(opened.db),
      projects = new ProjectRepository(opened.db);
    const project = await projects.create({
      name: "A",
      repositoryRoot: "C:\\a",
      defaultBranch: "main",
      completionPolicy: "manual",
    });
    const task = await tasks.create({
      title: "T",
      source: "manual",
      assignmentDescription: "",
      assignedToMe: true,
      occurredAt: new Date(),
    });
    await tasks.assignProject(task.id, project.id);
    const repository = new WorkflowRepository(opened.db);
    const run = await repository.create(task.id, project.id);
    const step = await repository.addStep(run.id, 0, "plan", null, null);
    await repository.setState(run.id, "running", "plan");
    await repository.startStep(step.id);
    expect(await repository.recoverInterrupted()).toBe(1);
    expect(await repository.get(run.id)).toMatchObject({
      status: "paused",
      error: "Recovered after an interrupted application session",
    });
    expect((await repository.steps(run.id))[0]).toMatchObject({
      status: "failed",
    });
    expect((await repository.history(run.id)).at(-1)?.type).toBe(
      "workflow.recovered",
    );
    opened.client.close();
  });
});
