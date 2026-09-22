import type { AgentCapability, AgentRoleInput } from "../src/domain/agent-role.js";
import type {
  AutonomyMode,
  CompletionPolicy,
  ExecutionPolicy,
} from "../src/domain/project.js";
import type { TaskSource, TaskStatus } from "../src/domain/task.js";
import type {
  ProviderAuthMethod,
  ProviderKind,
  ProviderStatus,
} from "../src/domain/provider.js";
import type { BrowserTestConfig, BrowserSetupSuggestion } from "../src/domain/browser-test.js";
import type { SkillSnapshotInput } from "../src/domain/instruction.js";
import type { NotificationKind } from "../src/domain/notification.js";
import type {
  ApprovalKind,
  WorkflowRunStatus,
  WorkflowStage,
  WorkflowStepStatus,
} from "../src/domain/workflow.js";

export interface DesktopSnapshot {
  projects: Array<{
    id: string;
    name: string;
    repositoryRoot: string;
    defaultBranch: string;
    completionPolicy: CompletionPolicy;
    autonomyMode: AutonomyMode;
  }>;
  tasks: Array<{
    id: string;
    projectId: string | null;
    title: string;
    source: TaskSource;
    status: TaskStatus;
    updatedAt: Date;
  }>;
  archivedTasks: Array<{
    id: string;
    projectId: string | null;
    title: string;
    source: TaskSource;
    status: TaskStatus;
    updatedAt: Date;
  }>;
  roles: Array<{
    id: string;
    projectId: string | null;
    name: string;
    description: string;
    providerId: string | null;
    modelId: string | null;
    capabilities: AgentCapability[];
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
    lastCheckedAt: Date | null;
  }>;
  runs: Array<{
    id: string;
    taskId: string;
    projectId: string;
    status: WorkflowRunStatus;
    currentStage: WorkflowStage | null;
    error: string | null;
    updatedAt: Date;
    stepStatus: WorkflowStepStatus | null;
  }>;
  archivedRuns: Array<{
    id: string;
    taskId: string;
    projectId: string;
    status: WorkflowRunStatus;
    currentStage: WorkflowStage | null;
    error: string | null;
    updatedAt: Date;
    stepStatus: WorkflowStepStatus | null;
  }>;
  approvals: Array<{
    id: string;
    runId: string;
    kind: ApprovalKind;
    status: "pending" | "approved" | "rejected";
    detail: string;
    requestedAt: Date;
    planContent?: string;
    planVersion?: number;
  }>;
  notifications: Array<{
    key: string;
    taskId: string;
    kind: NotificationKind;
    severity: string;
    title: string;
    detail: string;
    suggestedAction: string;
  }>;
}

export interface DesktopApi {
  onActivity(listener: (pendingOperations: number) => void): () => void;
  onFeedback(
    listener: (feedback: {
      message: string;
      tone: "success" | "error";
      details?: string;
    }) => void,
  ): () => void;
  snapshot(): Promise<DesktopSnapshot>;
  exportData(): Promise<string | null>;
  selectProjectDirectory(): Promise<string | null>;
  addProject(input: {
    name: string;
    repositoryRoot: string;
    defaultBranch: string;
    completionPolicy: CompletionPolicy;
    autonomyMode: AutonomyMode;
    initializeGit: boolean;
  }): Promise<void>;
  captureTask(input: {
    title: string;
    source: TaskSource;
    description: string;
    acceptanceCriteria: string[];
    projectId: string | null;
  }): Promise<void>;
  taskAction(input: {
    taskId: string;
    action:
      | "confirm"
      | "claim"
      | "reject"
      | "start"
      | "pause"
      | "resume"
      | "archive"
      | "restore"
      | "delete";
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
    action: "next" | "pause" | "resume" | "cancel" | "archive" | "restore" | "delete";
  }): Promise<void>;
  decideApproval(input: {
    approvalId: string;
    approved: boolean;
  }): Promise<void>;
  taskCompletion(input: {
    taskId: string;
    action: "prepare" | "edit" | "finish";
    description?: string;
  }): Promise<void>;
  taskCompletionDraft(taskId: string): Promise<string>;
  taskSummary(taskId: string): Promise<unknown>;
  gitReview(runId: string): Promise<unknown>;
  gitCommit(input: { runId: string; message: string }): Promise<void>;
  gitPush(runId: string): Promise<void>;
  saveBrowserConfig(input: { config: BrowserTestConfig; confirmLocalhostAccess: true }): Promise<void>;
  suggestBrowserConfig(projectId: string): Promise<BrowserSetupSuggestion>;
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
