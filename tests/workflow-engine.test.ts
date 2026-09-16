import { describe, expect, it } from "vitest";
import type { AgentRunner } from "../src/domain/agent-runner.js";
import {
  WorkflowEngine,
  type AgentRunnerFactory,
} from "../src/application/workflow-engine.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { AgentRoleRepository } from "../src/infrastructure/repositories/agent-role-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { ProviderRepository } from "../src/infrastructure/repositories/provider-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";
describe("WorkflowEngine", () => {
  it("executes a snapshotted stage in its task worktree", async () => {
    const opened = await openDatabase(":memory:");
    const tasks = new TaskRepository(opened.db),
      projects = new ProjectRepository(opened.db),
      roles = new AgentRoleRepository(opened.db),
      providers = new ProviderRepository(opened.db),
      runs = new WorkflowRepository(opened.db);
    const project = await projects.create({
      name: "App",
      repositoryRoot: "C:\\app",
      defaultBranch: "main",
      completionPolicy: "manual",
    });
    await projects.saveExecutionPolicy(project.id, {
      networkAccess: "public",
      autoGrantAgentAccess: true,
      environmentAllowlist: [],
      commandAllowlist: ["codex"],
      processTimeoutSeconds: 900,
      requirePushApproval: true,
      isolatedBrowserProfile: true,
    });
    const task = await tasks.create({
      title: "Fix",
      source: "manual",
      assignmentDescription: "Bug",
      assignedToMe: true,
      occurredAt: new Date(),
    });
    await tasks.assignProject(task.id, project.id);
    const role = await roles.create(
      {
        projectId: null,
        slug: "worker",
        name: "Worker",
        description: "Works",
        promptTemplate: "Default",
        providerId: null,
        modelId: null,
        capabilities: ["code"],
        limits: { maxTurns: 2, timeoutSeconds: 30, maxRetries: 1 },
        enabled: true,
      },
      false,
    );
    const provider = await providers.create({
      name: "Provider",
      kind: "openai",
      authMethod: "cli",
      command: "codex",
      models: ["model"],
    });
    await providers.recordCheck(provider.id, "ready", null);
    await roles.assignModel(role.id, provider.id, "model");
    const run = await runs.create(task.id, project.id);
    await runs.addStep(run.id, 0, "implement", role.id, {
      content: "Snapshot",
    });
    await runs.setState(run.id, "running", "implement");
    let seen: any;
    const runner: AgentRunner = {
      run: async (input) => {
        seen = input;
        return { success: true, summary: "done", transcript: "evidence" };
      },
    };
    const factory: AgentRunnerFactory = { create: () => runner };
    const worktree = {
      id: "w",
      taskId: task.id,
      projectId: project.id,
      path: "C:\\work",
      branch: "b",
      baseBranch: "main",
      status: "active" as const,
      createdAt: new Date(),
      releasedAt: null,
    };
    const engine = new WorkflowEngine(
      runs,
      tasks,
      projects,
      roles,
      providers,
      { create: async () => worktree } as any,
      factory,
    );
    await engine.executeNext(run.id);
    expect(seen).toMatchObject({
      instructions: "Snapshot",
      worktreePath: "C:\\work",
    });
    expect((await runs.steps(run.id))[0]).toMatchObject({
      status: "passed",
      output: "evidence",
    });
    expect(await runs.get(run.id)).toMatchObject({
      status: "running",
      currentStage: null,
    });
    opened.client.close();
  });
  it("grants provider runtime access automatically without disabling push approval", async () => {
    const opened = await openDatabase(":memory:");
    const tasks = new TaskRepository(opened.db),
      projects = new ProjectRepository(opened.db),
      roles = new AgentRoleRepository(opened.db),
      providers = new ProviderRepository(opened.db),
      runs = new WorkflowRepository(opened.db);
    const project = await projects.create({
      name: "App",
      repositoryRoot: "C:\\app",
      defaultBranch: "main",
      completionPolicy: "manual",
    });
    const task = await tasks.create({
      title: "Fix",
      source: "manual",
      assignmentDescription: "Bug",
      assignedToMe: true,
      occurredAt: new Date(),
    });
    await tasks.assignProject(task.id, project.id);
    const role = await roles.create(
      {
        projectId: null,
        slug: "worker",
        name: "Worker",
        description: "Works",
        promptTemplate: "Default",
        providerId: null,
        modelId: null,
        capabilities: ["code"],
        limits: { maxTurns: 2, timeoutSeconds: 30, maxRetries: 1 },
        enabled: true,
      },
      false,
    );
    const provider = await providers.create({
      name: "Provider",
      kind: "openai",
      authMethod: "cli",
      command: "C:\\Tools\\codex.exe",
      models: ["model"],
    });
    await providers.recordCheck(provider.id, "ready", null);
    await roles.assignModel(role.id, provider.id, "model");
    const run = await runs.create(task.id, project.id);
    await runs.addStep(run.id, 0, "implement", role.id, {
      content: "Snapshot",
    });
    await runs.setState(run.id, "running", "implement");
    const engine = new WorkflowEngine(
      runs,
      tasks,
      projects,
      roles,
      providers,
      {
        create: async () => ({
          id: "w",
          taskId: task.id,
          projectId: project.id,
          path: "C:\\work",
          branch: "b",
          baseBranch: "main",
          status: "active",
          createdAt: new Date(),
          releasedAt: null,
        }),
      } as any,
      {
        create: () => ({
          run: async () => ({
            success: true,
            summary: "done",
            transcript: "done",
          }),
        }),
      },
    );
    await engine.executeNext(run.id);
    expect(await projects.executionPolicy(project.id)).toMatchObject({
      networkAccess: "public",
      requirePushApproval: true,
      commandAllowlist: expect.arrayContaining(["C:\\Tools\\codex.exe"]),
    });
    opened.client.close();
  });
});
