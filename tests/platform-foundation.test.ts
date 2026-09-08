import { describe, expect, it } from "vitest";
import { ProjectService } from "../src/application/project-service.js";
import { TaskService } from "../src/application/task-service.js";
import { WorktreeService, type GitWorktreeDriver } from "../src/application/worktree-service.js";
import { ExecutionGuard } from "../src/application/execution-guard.js";
import { MockCrmAdapter } from "../src/infrastructure/crm/mock-crm-adapter.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";

const inspector = { inspect: async (project: { id: string }) => ({ projectId: project.id, ready: true, checkedAt: new Date(), checks: [] }) };

describe("platform execution foundation", () => {
  it("assigns tasks to projects and filters the project queue", async () => {
    const opened = await openDatabase(":memory:"); const projects = new ProjectRepository(opened.db); const tasks = new TaskRepository(opened.db);
    const project = await new ProjectService(projects, inspector).register({ name: "Web", repositoryRoot: "C:\\code\\web", defaultBranch: "main", completionPolicy: "manual" });
    const service = new TaskService(tasks, new MockCrmAdapter("unused.json"));
    const task = await service.capture({ title: "Fix login", source: "manual", assignmentDescription: "", assignedToMe: true, occurredAt: new Date() });
    expect((await service.assignProject(task.id, project.id, projects)).projectId).toBe(project.id);
    expect((await service.tasksForProject(project.id)).map((item) => item.id)).toEqual([task.id]);
    expect((await tasks.history(task.id)).at(-1)?.type).toBe("task.project_assigned"); await opened.client.close();
  });

  it("defaults to restrictive permissions and snapshots policy changes", async () => {
    const opened = await openDatabase(":memory:"); const repository = new ProjectRepository(opened.db); const service = new ProjectService(repository, inspector);
    const project = await service.register({ name: "API", repositoryRoot: "C:\\code\\api", defaultBranch: "main", completionPolicy: "manual" });
    expect(await service.executionPolicy(project.id)).toMatchObject({ networkAccess: "none", environmentAllowlist: [], requirePushApproval: true, isolatedBrowserProfile: true });
    await service.setExecutionPolicy(project.id, { networkAccess: "localhost", environmentAllowlist: ["NODE_ENV"], commandAllowlist: ["git", "pnpm"], processTimeoutSeconds: 600, requirePushApproval: true, isolatedBrowserProfile: true });
    expect((await repository.history(project.id)).at(-1)?.type).toBe("project.execution_policy_changed"); await opened.client.close();
  });

  it("creates one isolated write worktree per project and releases it", async () => {
    const opened = await openDatabase(":memory:"); const projects = new ProjectRepository(opened.db); const tasks = new TaskRepository(opened.db); const calls: string[] = [];
    const git: GitWorktreeDriver = { create: async (_root, path, branch) => { calls.push(`create:${path}:${branch}`); }, remove: async (_root, path) => { calls.push(`remove:${path}`); } };
    const project = await new ProjectService(projects, inspector).register({ name: "App", repositoryRoot: "C:\\code\\app", defaultBranch: "main", completionPolicy: "manual" });
    const service = new TaskService(tasks, new MockCrmAdapter("unused.json"));
    const first = await service.capture({ title: "One", source: "manual", assignmentDescription: "", assignedToMe: true, occurredAt: new Date() });
    const second = await service.capture({ title: "Two", source: "manual", assignmentDescription: "", assignedToMe: true, occurredAt: new Date() });
    await service.assignProject(first.id, project.id, projects); await service.assignProject(second.id, project.id, projects);
    const worktrees = new WorktreeService(projects, tasks, git); const created = await worktrees.create(first.id);
    await expect(worktrees.create(second.id)).rejects.toThrow("active write worktree");
    expect((await worktrees.release(first.id)).status).toBe("released"); expect(calls).toHaveLength(2); await opened.client.close();
  });

  it("enforces worktree, command, environment, network, and push boundaries", () => {
    const guard = new ExecutionGuard("C:\\worktrees\\task", { networkAccess: "localhost", environmentAllowlist: ["NODE_ENV"], commandAllowlist: ["git", "pnpm"], processTimeoutSeconds: 60, requirePushApproval: true, isolatedBrowserProfile: true });
    expect(guard.assertWritablePath("C:\\worktrees\\task\\src\\app.ts")).toContain("app.ts");
    expect(() => guard.assertWritablePath("C:\\normal-repo\\secret.ts")).toThrow("Write denied");
    expect(() => guard.assertCommand("powershell.exe")).toThrow("not allowed"); guard.assertCommand("pnpm.cmd");
    expect(guard.filterEnvironment({ NODE_ENV: "test", TOKEN: "secret" })).toEqual({ NODE_ENV: "test" });
    guard.assertNetwork("localhost"); expect(() => guard.assertNetwork("public")).toThrow("Network access denied");
    expect(() => guard.assertPushApproved(false)).toThrow("requires developer approval");
  });
});
