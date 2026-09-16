import { z } from "zod";

export const SkillSourceSchema = z.enum(["built_in", "repository", "personal"]);
export const SkillPermissionSchema = z.enum(["read_repository", "write_worktree", "run_commands", "localhost", "public_network", "browser", "git_commit", "git_push"]);
export type SkillPermission = z.infer<typeof SkillPermissionSchema>;
export const SkillSnapshotInputSchema = z.object({
  projectId: z.string().uuid().nullable().default(null), source: SkillSourceSchema,
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120), version: z.string().trim().min(1).max(40),
  content: z.string().min(1).max(200_000), permissions: z.array(SkillPermissionSchema).max(20), reviewed: z.boolean()
});
export type SkillSnapshotInput = z.infer<typeof SkillSnapshotInputSchema>;
export interface SkillSnapshot extends SkillSnapshotInput { id: string; contentHash: string; createdAt: Date; }
export interface PromptVersion { id: string; roleId: string; version: number; content: string; createdAt: Date; }
export interface EffectiveInstructions { roleId: string; prompt: PromptVersion; skills: SkillSnapshot[]; content: string; warnings: string[]; contentHash: string; }
