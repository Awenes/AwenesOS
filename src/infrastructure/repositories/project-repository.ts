import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { ExecutionPolicySchema, type CompletionPolicy, type ExecutionPolicy, type Project, type RegisterProject, type TaskWorktree } from "../../domain/project.js";
import type { Database } from "../db/database.js";
import { projectEvents, projectExecutionPolicies, projects, taskWorktrees } from "../db/schema.js";

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  async create(input: RegisterProject): Promise<Project> {
    const now = new Date();
    const project: Project = { id: randomUUID(), ...input, autonomyMode: input.autonomyMode ?? "balanced", createdAt: now, updatedAt: now };
    await this.db.insert(projects).values(project);
    await this.event(project.id, "project.registered", { repositoryRoot: project.repositoryRoot, completionPolicy: project.completionPolicy }, now);
    return project;
  }

  async get(id: string): Promise<Project> {
    const row = await this.db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (!row) throw new Error(`Project not found: ${id}`);
    return row as Project;
  }

  async list(): Promise<Project[]> { return await this.db.select().from(projects).orderBy(asc(projects.name)) as Project[]; }

  async setCompletionPolicy(id: string, completionPolicy: CompletionPolicy): Promise<Project> {
    const current = await this.get(id);
    if (current.completionPolicy === completionPolicy) return current;
    const now = new Date();
    await this.db.update(projects).set({ completionPolicy, updatedAt: now }).where(eq(projects.id, id));
    await this.event(id, "project.completion_policy_changed", { from: current.completionPolicy, to: completionPolicy }, now);
    return this.get(id);
  }

  history(projectId: string) { return this.db.select().from(projectEvents).where(eq(projectEvents.projectId, projectId)).orderBy(asc(projectEvents.occurredAt)); }

  async recordRepositoryInitialized(projectId: string) {
    await this.get(projectId);
    await this.event(projectId, "project.repository_initialized", {});
  }

  async executionPolicy(projectId: string): Promise<ExecutionPolicy> {
    await this.get(projectId);
    const row = await this.db.query.projectExecutionPolicies.findFirst({ where: eq(projectExecutionPolicies.projectId, projectId) });
    return ExecutionPolicySchema.parse(row?.policy ?? {});
  }

  async saveExecutionPolicy(projectId: string, input: ExecutionPolicy): Promise<ExecutionPolicy> {
    await this.get(projectId); const policy = ExecutionPolicySchema.parse(input); const now = new Date();
    await this.db.insert(projectExecutionPolicies).values({ projectId, policy, updatedAt: now }).onConflictDoUpdate({ target: projectExecutionPolicies.projectId, set: { policy, updatedAt: now } });
    await this.event(projectId, "project.execution_policy_changed", { policy }, now); return policy;
  }

  async activeWorktree(projectId: string): Promise<TaskWorktree | null> {
    const row = await this.db.query.taskWorktrees.findFirst({ where: and(eq(taskWorktrees.projectId, projectId), eq(taskWorktrees.status, "active")) });
    return row ? row as TaskWorktree : null;
  }

  async worktreeForTask(taskId: string): Promise<TaskWorktree | null> {
    const row = await this.db.query.taskWorktrees.findFirst({ where: eq(taskWorktrees.taskId, taskId) }); return row ? row as TaskWorktree : null;
  }

  async saveWorktree(input: Omit<TaskWorktree, "id" | "createdAt" | "releasedAt" | "status">): Promise<TaskWorktree> {
    const row: TaskWorktree = { id: randomUUID(), ...input, status: "active", createdAt: new Date(), releasedAt: null };
    await this.db.insert(taskWorktrees).values(row); await this.event(input.projectId, "project.worktree_created", { taskId: input.taskId, path: input.path, branch: input.branch }); return row;
  }

  async releaseWorktree(taskId: string): Promise<TaskWorktree> {
    const current = await this.worktreeForTask(taskId); if (!current || current.status !== "active") throw new Error(`No active worktree for task ${taskId}`);
    const now = new Date(); await this.db.update(taskWorktrees).set({ status: "released", releasedAt: now }).where(eq(taskWorktrees.taskId, taskId));
    await this.event(current.projectId, "project.worktree_released", { taskId, path: current.path }, now); return (await this.worktreeForTask(taskId))!;
  }

  private async event(projectId: string, type: string, data: Record<string, unknown>, occurredAt = new Date()) {
    await this.db.insert(projectEvents).values({ id: randomUUID(), projectId, type, data, occurredAt });
  }
}
