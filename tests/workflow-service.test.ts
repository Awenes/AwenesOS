import { describe, expect, it } from "vitest";
import { AgentRoleService } from "../src/application/agent-role-service.js";
import { InstructionService } from "../src/application/instruction-service.js";
import { ProjectService } from "../src/application/project-service.js";
import { TaskService } from "../src/application/task-service.js";
import { WorkflowService } from "../src/application/workflow-service.js";
import { ManualCrmAdapter } from "../src/infrastructure/crm/manual-crm-adapter.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { AgentRoleRepository } from "../src/infrastructure/repositories/agent-role-repository.js";
import { InstructionRepository } from "../src/infrastructure/repositories/instruction-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";
describe("WorkflowService", () => {
  it("snapshots instructions and waits for explicit start approval", async () => {
    const opened = await openDatabase(":memory:");
    const tasks = new TaskRepository(opened.db),
      projects = new ProjectRepository(opened.db),
      roles = new AgentRoleRepository(opened.db),
      runs = new WorkflowRepository(opened.db);
    const roleService = new AgentRoleService(roles, projects);
    await roleService.initializeBuiltIns();
    const project = await new ProjectService(projects, {
      inspect: async (p) => ({
        projectId: p.id,
        ready: true,
        checkedAt: new Date(),
        checks: [],
      }),
    }).register({
      name: "App",
      repositoryRoot: "C:\\app",
      defaultBranch: "main",
      completionPolicy: "manual",
    });
    const taskService = new TaskService(
      tasks,
      new ManualCrmAdapter(),
      "manual",
    );
    const task = await taskService.capture({
      title: "Feature",
      source: "manual",
      assignmentDescription: "Build it",
      assignedToMe: false,
      occurredAt: new Date(),
    });
    await taskService.assignProject(task.id, project.id, projects);
    const service = new WorkflowService(
      runs,
      tasks,
      projects,
      roles,
      new InstructionService(new InstructionRepository(opened.db), roles),
    );
    const created = await service.create(task.id);
    expect(created.run.status).toBe("awaiting_approval");
    expect(await service.steps(created.run.id)).toHaveLength(5);
    expect(
      (await service.steps(created.run.id))[0]?.instructionSnapshot,
    ).toMatchObject({ promptVersion: 1 });
    expect((await service.approvals(created.run.id))[0]?.kind).toBe("start");
    expect((await service.decide(created.approval.id, true)).status).toBe(
      "running",
    );
    expect(
      (await runs.history(created.run.id)).map((event) => event.type),
    ).toContain("approval.approved");
    const completion = await service.request(
      created.run.id,
      "completion",
      "Review evidence",
    );
    expect((await service.decide(completion.id, true)).status).toBe(
      "completed",
    );
    opened.client.close();
  });
});
