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
