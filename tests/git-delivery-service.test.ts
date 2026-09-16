import { describe, expect, it } from "vitest";
import { GitDeliveryService } from "../src/application/git-delivery-service.js";
import type { GitDeliveryDriver } from "../src/domain/git-delivery.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { GitDeliveryRepository } from "../src/infrastructure/repositories/git-delivery-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";
describe("GitDeliveryService", () => {
  it("records review and commit but requires explicit push approval", async () => {
    const opened = await openDatabase(":memory:");
    const projects = new ProjectRepository(opened.db),
      tasks = new TaskRepository(opened.db),
      runs = new WorkflowRepository(opened.db),
      deliveries = new GitDeliveryRepository(opened.db);
    const project = await projects.create({
      name: "App",
      repositoryRoot: "C:\\app",
      defaultBranch: "main",
      completionPolicy: "approve_push",
    });
    const task = await tasks.create({
      title: "T",
      source: "manual",
      assignmentDescription: "",
      assignedToMe: true,
      occurredAt: new Date(),
    });
    await tasks.assignProject(task.id, project.id);
    const run = await runs.create(task.id, project.id);
    await runs.addStep(run.id, 0, "delivery", null, null);
    await projects.saveWorktree({
      taskId: task.id,
      projectId: project.id,
      path: "C:\\work",
      branch: "awenes/task",
      baseBranch: "main",
    });
    const calls: string[] = [];
    const git: GitDeliveryDriver = {
      review: async () => ({
        branch: "awenes/task",
        head: "old",
        status: " M file.ts",
        diffStat: "1 file",
        diff: "patch",
      }),
      commit: async (_path, message) => {
        calls.push(`commit:${message}`);
        return "abc";
      },
      push: async (_path, remote, branch) => {
        calls.push(`push:${remote}:${branch}`);
      },
    };
    const service = new GitDeliveryService(deliveries, runs, projects, git);
    expect((await service.review(run.id)).review.diff).toBe("patch");
    expect((await service.commit(run.id, "feat: finish")).commitSha).toBe(
      "abc",
    );
    await expect(service.push(run.id)).rejects.toThrow("approval");
    const approval = await runs.requestApproval(
      run.id,
      "push",
      "Push reviewed commit",
    );
    await runs.decide(approval.id, true);
    expect((await service.push(run.id)).status).toBe("completed");
    expect((await runs.steps(run.id))[0]).toMatchObject({
      stage: "delivery",
      status: "passed",
      output: "Committed and pushed to origin/awenes/task.",
    });
    expect(calls).toEqual(["commit:feat: finish", "push:origin:awenes/task"]);
    expect((await runs.history(run.id)).map((event) => event.type)).toEqual(
      expect.arrayContaining(["git.reviewed", "git.committed", "git.pushed"]),
    );
    opened.client.close();
  });
  it("does not commit projects configured for manual delivery", async () => {
    const opened = await openDatabase(":memory:");
    const projects = new ProjectRepository(opened.db),
      tasks = new TaskRepository(opened.db),
      runs = new WorkflowRepository(opened.db);
    const project = await projects.create({
      name: "Manual",
      repositoryRoot: "C:\\manual",
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
    const run = await runs.create(task.id, project.id);
    await projects.saveWorktree({
      taskId: task.id,
      projectId: project.id,
      path: "C:\\work",
      branch: "b",
      baseBranch: "main",
    });
    const git = {} as GitDeliveryDriver;
    await expect(
      new GitDeliveryService(
        new GitDeliveryRepository(opened.db),
        runs,
        projects,
        git,
      ).commit(run.id, "message"),
    ).rejects.toThrow("manual");
    opened.client.close();
  });
});
