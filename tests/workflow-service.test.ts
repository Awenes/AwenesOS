import { describe, expect, it } from "vitest";
import { AgentRoleService } from "../src/application/agent-role-service.js";
import { InstructionService } from "../src/application/instruction-service.js";
import { ProjectService } from "../src/application/project-service.js";
import { TaskService } from "../src/application/task-service.js";
import { WorkflowService } from "../src/application/workflow-service.js";
import { WorktreeService } from "../src/application/worktree-service.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { AgentRoleRepository } from "../src/infrastructure/repositories/agent-role-repository.js";
import { InstructionRepository } from "../src/infrastructure/repositories/instruction-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { ProviderRepository } from "../src/infrastructure/repositories/provider-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";
describe("WorkflowService", () => {
  it("snapshots instructions and waits for explicit start approval", async () => {
    const opened = await openDatabase(":memory:");
    const tasks = new TaskRepository(opened.db),
      projects = new ProjectRepository(opened.db),
      roles = new AgentRoleRepository(opened.db),
      runs = new WorkflowRepository(opened.db);
    const roleService = new AgentRoleService(roles, projects, new ProviderRepository(opened.db));
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
    const taskService = new TaskService(tasks);
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
      new WorktreeService(projects, tasks, {
        create: async () => {},
        remove: async () => {},
      }),
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
    const plan = await runs.createPlan(created.run.id, "Implement, review, and test the feature.");
    const planApproval = await service.request(created.run.id, "plan", "Review plan");
    expect((await service.decide(planApproval.id, false)).status).toBe("paused");
    expect((await service.plans(created.run.id))[0]).toMatchObject({ id: plan.id, status: "changes_requested" });
    expect(await service.interventions(created.run.id)).toMatchObject([{ kind: "review", status: "open" }]);
    await service.resume(created.run.id);
    const completion = await service.request(
      created.run.id,
      "completion",
      "Review evidence",
    );
    expect((await service.decide(completion.id, true)).status).toBe(
      "completed",
    );
    expect(
      (await service.steps(created.run.id)).find(
        (step) => step.stage === "delivery",
      ),
    ).toMatchObject({
      status: "passed",
      output: "Delivery reviewed and completed manually by the developer.",
    });
    opened.client.close();
  });
});
