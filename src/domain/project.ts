import { z } from "zod";

export const CompletionPolicySchema = z.enum(["manual", "approve_push", "auto_push"]);
export type CompletionPolicy = z.infer<typeof CompletionPolicySchema>;

export const RegisterProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  repositoryRoot: z.string().trim().min(1),
  defaultBranch: z.string().trim().min(1).default("main"),
  completionPolicy: CompletionPolicySchema.default("manual")
});
export type RegisterProject = z.infer<typeof RegisterProjectSchema>;

export interface Project extends RegisterProject {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReadinessCheckName = "repository" | "git" | "node" | "pnpm" | "worktree";
export interface ReadinessCheck { name: ReadinessCheckName; ready: boolean; required: boolean; detail: string; }
export interface ReadinessReport { projectId: string; ready: boolean; checkedAt: Date; checks: ReadinessCheck[]; }

export interface EnvironmentInspector { inspect(project: Project): Promise<ReadinessReport>; }

export const NetworkAccessSchema = z.enum(["none", "localhost", "public"]);
export const ExecutionPolicySchema = z.object({
  networkAccess: NetworkAccessSchema.default("none"),
  environmentAllowlist: z.array(z.string().trim().min(1)).default([]),
  commandAllowlist: z.array(z.string().trim().min(1)).default(["git", "node", "pnpm"]),
  processTimeoutSeconds: z.number().int().min(1).max(3600).default(900),
  requirePushApproval: z.boolean().default(true),
  isolatedBrowserProfile: z.literal(true).default(true)
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

export interface TaskWorktree {
  id: string; taskId: string; projectId: string; path: string; branch: string; baseBranch: string;
  status: "active" | "released"; createdAt: Date; releasedAt: Date | null;
}
