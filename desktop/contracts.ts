import type { AgentRoleInput } from "../src/domain/agent-role.js";
import type { CompletionPolicy, ExecutionPolicy } from "../src/domain/project.js";
import type { TaskSource } from "../src/domain/task.js";
import type { ProviderAuthMethod, ProviderKind, ProviderStatus } from "../src/domain/provider.js";

export interface DesktopSnapshot {
  projects: Array<{ id: string; name: string; repositoryRoot: string; defaultBranch: string; completionPolicy: CompletionPolicy }>;
  tasks: Array<{ id: string; projectId: string | null; title: string; source: TaskSource; status: string; updatedAt: Date }>;
  roles: Array<{ id: string; projectId: string | null; name: string; description: string; providerId: string | null; modelId: string | null; capabilities: string[]; enabled: boolean; builtIn: boolean }>;
  providers: Array<{ id: string; name: string; kind: ProviderKind; authMethod: ProviderAuthMethod; command: string | null; models: string[]; status: ProviderStatus; error: string | null }>;
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
  connectProvider(input: { name: string; kind: ProviderKind; authMethod: ProviderAuthMethod; command: string | null; models: string[]; apiKey?: string }): Promise<void>;
  verifyProvider(providerId: string): Promise<void>;
  disconnectProvider(providerId: string): Promise<void>;
}
