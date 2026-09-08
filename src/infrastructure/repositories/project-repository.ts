import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { CompletionPolicy, Project, RegisterProject } from "../../domain/project.js";
import type { Database } from "../db/database.js";
import { projectEvents, projects } from "../db/schema.js";

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  async create(input: RegisterProject): Promise<Project> {
    const now = new Date();
    const project: Project = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
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

  private async event(projectId: string, type: string, data: Record<string, unknown>, occurredAt = new Date()) {
    await this.db.insert(projectEvents).values({ id: randomUUID(), projectId, type, data, occurredAt });
  }
}
