import { describe, expect, it } from "vitest";
import { TaskService } from "../src/application/task-service.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";

describe("local task service", () => {
  it("captures, plans, pauses, reviews, and completes locally without external updates", async () => {
    const opened = await openDatabase(":memory:");
    try {
      const repository = new TaskRepository(opened.db);
      const service = new TaskService(repository);
      const task = await service.capture({ title: "Fix onboarding", source: "manual", assignmentDescription: "Check the form", assignedToMe: true, occurredAt: new Date() });
      await service.claim(task.id);
      await service.start(task.id);
      await service.pause(task.id);
      await service.resume(task.id);
      await service.draftCompletion(task.id);
      await service.prepareCompletion(task.id, "Implemented and checked the form");
      expect((await service.complete(task.id)).status).toBe("completed");
      expect((await service.history(task.id)).at(-1)?.type).toBe("task.completed");
    } finally { opened.client.close(); }
  });

  it("refuses to reassign a task's project while it has an active worktree", async () => {
    const opened = await openDatabase(":memory:");
    try {
      const repository = new TaskRepository(opened.db);
      const projects = new ProjectRepository(opened.db);
      const service = new TaskService(repository);
      const projectA = await projects.create({ name: "A", repositoryRoot: "C:\\a", defaultBranch: "main", completionPolicy: "manual" });
      const projectB = await projects.create({ name: "B", repositoryRoot: "C:\\b", defaultBranch: "main", completionPolicy: "manual" });
      const task = await service.capture({ title: "Fix", source: "manual", assignmentDescription: "Bug", assignedToMe: true, occurredAt: new Date() });
      await service.assignProject(task.id, projectA.id, projects);
      await projects.saveWorktree({ taskId: task.id, projectId: projectA.id, path: "C:\\a\\.awenes-worktrees\\fix", branch: "awenes/task-fix", baseBranch: "main" });
      await expect(service.assignProject(task.id, projectB.id, projects)).rejects.toThrow(
        "Release the task's active worktree before reassigning its project",
      );
      await projects.releaseWorktree(task.id);
      await expect(service.assignProject(task.id, projectB.id, projects)).resolves.toMatchObject({ projectId: projectB.id });
    } finally { opened.client.close(); }
  });
});
