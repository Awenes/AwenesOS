import { z } from "zod";

export const CompletionPolicySchema = z.enum([
  "manual",
  "approve_push",
  "auto_push",
]);
export type CompletionPolicy = z.infer<typeof CompletionPolicySchema>;
export const AutonomyModeSchema = z.enum(["guided", "balanced", "autonomous"]);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

export const RegisterProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  repositoryRoot: z.string().trim().min(1),
  defaultBranch: z.string().trim().min(1).default("main"),
  completionPolicy: CompletionPolicySchema.default("manual"),
  autonomyMode: AutonomyModeSchema.default("balanced"),
});
export interface RegisterProject {
  name: string;
  repositoryRoot: string;
  defaultBranch: string;
  completionPolicy: CompletionPolicy;
  autonomyMode?: AutonomyMode;
}

export interface Project extends Omit<RegisterProject, "autonomyMode"> {
  id: string;
  autonomyMode: AutonomyMode;
  createdAt: Date;
  updatedAt: Date;
}

// "repository", "worktree", and "browser" are always checked; every other
// name is a command from that project's own ExecutionPolicy.commandAllowlist.
export type ReadinessCheckName = string;
export interface ReadinessCheck {
  name: ReadinessCheckName;
  ready: boolean;
  required: boolean;
  detail: string;
}
export interface ReadinessReport {
  projectId: string;
  ready: boolean;
  checkedAt: Date;
  checks: ReadinessCheck[];
}

export interface EnvironmentInspector {
  inspect(project: Project, policy: ExecutionPolicy): Promise<ReadinessReport>;
}

export interface GitRepositoryInitializer {
  isRepository(root: string): Promise<boolean>;
  initialize(root: string, defaultBranch: string): Promise<void>;
}

export const NetworkAccessSchema = z.enum(["none", "localhost", "public"]);
export const ExecutionPolicySchema = z.object({
  networkAccess: NetworkAccessSchema.default("none"),
  autoGrantAgentAccess: z.boolean().default(true),
  environmentAllowlist: z.array(z.string().trim().min(1)).default([]),
  commandAllowlist: z
    .array(z.string().trim().min(1))
    .default(["git", "node", "pnpm"]),
  processTimeoutSeconds: z.number().int().min(1).max(3600).default(900),
  requirePushApproval: z.boolean().default(true),
  isolatedBrowserProfile: z.literal(true).default(true),
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

export interface TaskWorktree {
  id: string;
  taskId: string;
  projectId: string;
  path: string;
  branch: string;
  baseBranch: string;
  status: "active" | "released";
  createdAt: Date;
  releasedAt: Date | null;
}
