import type { AgentRoleInput } from "../src/domain/agent-role.js";
import type {
  CompletionPolicy,
  ExecutionPolicy,
} from "../src/domain/project.js";
import type { TaskSource } from "../src/domain/task.js";
import type {
  ProviderAuthMethod,
  ProviderKind,
  ProviderStatus,
} from "../src/domain/provider.js";
import type { BrowserTestConfig } from "../src/domain/browser-test.js";
import type { SkillSnapshotInput } from "../src/domain/instruction.js";

export interface DesktopSnapshot {
  projects: Array<{
    id: string;
    name: string;
    repositoryRoot: string;
    defaultBranch: string;
    completionPolicy: CompletionPolicy;
  }>;
  tasks: Array<{
    id: string;
    projectId: string | null;
    title: string;
    source: TaskSource;
    status: string;
    updatedAt: Date;
  }>;
  roles: Array<{
    id: string;
    projectId: string | null;
    name: string;
    description: string;
    providerId: string | null;
    modelId: string | null;
    capabilities: string[];
    enabled: boolean;
    builtIn: boolean;
  }>;
  providers: Array<{
    id: string;
    name: string;
    kind: ProviderKind;
    authMethod: ProviderAuthMethod;
    command: string | null;
    models: string[];
    status: ProviderStatus;
    error: string | null;
  }>;
  runs: Array<{
    id: string;
    taskId: string;
    projectId: string;
    status: string;
    currentStage: string | null;
    error: string | null;
    updatedAt: Date;
  }>;
  approvals: Array<{
    id: string;
    runId: string;
    kind: string;
    status: string;
    detail: string;
    requestedAt: Date;
  }>;
  notifications: Array<{
    key: string;
    taskId: string;
    severity: string;
    title: string;
    detail: string;
    suggestedAction: string;
  }>;
  pendingCrm: number;
  pendingTracker: number;
}

export interface DesktopApi {
  snapshot(): Promise<DesktopSnapshot>;
  addProject(input: {
    name: string;
    repositoryRoot: string;
    defaultBranch: string;
    completionPolicy: CompletionPolicy;
  }): Promise<void>;
  captureTask(input: {
    title: string;
    source: TaskSource;
    description: string;
    projectId: string | null;
  }): Promise<void>;
  taskAction(input: {
    taskId: string;
    action: "claim" | "start" | "pause" | "resume";
  }): Promise<void>;
  projectReadiness(projectId: string): Promise<unknown>;
  executionPolicy(projectId: string): Promise<ExecutionPolicy>;
  saveExecutionPolicy(input: {
    projectId: string;
    policy: ExecutionPolicy;
  }): Promise<void>;
  createRole(input: AgentRoleInput): Promise<void>;
  setRoleEnabled(input: { roleId: string; enabled: boolean }): Promise<void>;
  connectProvider(input: {
    name: string;
    kind: ProviderKind;
    authMethod: ProviderAuthMethod;
    command: string | null;
    models: string[];
    apiKey?: string;
  }): Promise<void>;
  verifyProvider(providerId: string): Promise<void>;
  disconnectProvider(providerId: string): Promise<void>;
  assignRoleModel(input: {
    roleId: string;
    providerId: string;
    modelId: string;
  }): Promise<void>;
  promptDetails(roleId: string): Promise<unknown>;
  savePrompt(input: { roleId: string; content: string }): Promise<void>;
  resetPrompt(roleId: string): Promise<void>;
  listSkills(projectId?: string): Promise<unknown[]>;
  saveSkill(input: SkillSnapshotInput): Promise<void>;
  attachSkill(input: {
    roleId: string;
    skillId: string;
    attached: boolean;
  }): Promise<void>;
  createRun(taskId: string): Promise<void>;
  runDetails(runId: string): Promise<unknown>;
  runAction(input: {
    runId: string;
    action: "next" | "pause" | "resume" | "cancel";
  }): Promise<void>;
  decideApproval(input: {
    approvalId: string;
    approved: boolean;
  }): Promise<void>;
  taskCompletion(input: {
    taskId: string;
    action: "prepare" | "finish" | "confirm_crm" | "confirm_tracker";
    description?: string;
  }): Promise<void>;
  taskSummary(taskId: string): Promise<unknown>;
  gitReview(runId: string): Promise<unknown>;
  gitCommit(input: { runId: string; message: string }): Promise<void>;
  gitPush(runId: string): Promise<void>;
  saveBrowserConfig(input: BrowserTestConfig): Promise<void>;
  saveBrowserCredential(input: {
    projectId: string;
    key: string;
    value: string;
  }): Promise<void>;
  runBrowserTest(runId: string): Promise<unknown>;
  browserEvidence(runId: string): Promise<unknown[]>;
  notificationAction(input: {
    key: string;
    action: "dismiss" | "snooze";
  }): Promise<void>;
}
