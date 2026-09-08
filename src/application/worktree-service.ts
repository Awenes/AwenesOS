import { basename, dirname, join, resolve } from "node:path";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";
import type { TaskRepository } from "../infrastructure/repositories/task-repository.js";

export interface GitWorktreeDriver {
  create(repositoryRoot: string, path: string, branch: string, baseBranch: string): Promise<void>;
  remove(repositoryRoot: string, path: string): Promise<void>;
}

export class WorktreeService {
  constructor(private readonly projects: ProjectRepository, private readonly tasks: TaskRepository, private readonly git: GitWorktreeDriver) {}

  async create(taskId: string) {
    const task = await this.tasks.get(taskId); if (!task.projectId) throw new Error("Assign the task to a project before creating a worktree");
    const existing = await this.projects.worktreeForTask(taskId); if (existing?.status === "active") return existing;
    const active = await this.projects.activeWorktree(task.projectId); if (active) throw new Error(`Project already has an active write worktree for task ${active.taskId}`);
    const project = await this.projects.get(task.projectId);
    const branch = `awenes/task-${task.id.slice(0, 8)}`;
    const path = resolve(join(dirname(project.repositoryRoot), ".awenes-worktrees", `${basename(project.repositoryRoot)}-${task.id.slice(0, 8)}`));
    await this.git.create(project.repositoryRoot, path, branch, project.defaultBranch);
    return this.projects.saveWorktree({ taskId, projectId: project.id, path, branch, baseBranch: project.defaultBranch });
  }

  async release(taskId: string) {
    const worktree = await this.projects.worktreeForTask(taskId); if (!worktree || worktree.status !== "active") throw new Error(`No active worktree for task ${taskId}`);
    const project = await this.projects.get(worktree.projectId); await this.git.remove(project.repositoryRoot, worktree.path); return this.projects.releaseWorktree(taskId);
  }
}
