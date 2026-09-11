import type { AgentRoleInput } from "../src/domain/agent-role.js";
import type { CompletionPolicy, ExecutionPolicy } from "../src/domain/project.js";
import type { TaskSource } from "../src/domain/task.js";

export interface DesktopSnapshot {
  projects: Array<{ id: string; name: string; repositoryRoot: string; defaultBranch: string; completionPolicy: CompletionPolicy }>;
  tasks: Array<{ id: string; projectId: string | null; title: string; source: TaskSource; status: string; updatedAt: Date }>;
  roles: Array<{ id: string; projectId: string | null; name: string; description: string; providerId: string | null; modelId: string | null; capabilities: string[]; enabled: boolean; builtIn: boolean }>;
  pendingCrm: number; pendingTracker: number;
}

export interface DesktopApi {
  snapshot(): Promise<DesktopSnapshot>;
  addProject(input: { name: string; repositoryRoot: string; defaultBranch: string; completionPolicy: CompletionPolicy }): Promise<void>;
  captureTask(input: { title: string; source: TaskSource; description: string; projectId: string | null }): Promise<void>;
  taskAction(input: { taskId: string; action: "claim" | "start" | "pause" | "resume" }): Promise<void>;
  projectReadiness(projectId: string): Promise<unknown>;
  executionPolicy(projectId: string): Promise<ExecutionPolicy>;
  saveExecutionPolicy(input: { projectId: string; policy: ExecutionPolicy }): Promise<void>;
  createRole(input: AgentRoleInput): Promise<void>;
  setRoleEnabled(input: { roleId: string; enabled: boolean }): Promise<void>;
}
