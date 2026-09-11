import { z } from "zod";

export const AgentCapabilitySchema = z.enum(["plan", "code", "test", "browser", "review", "git_commit", "git_push"]);
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const RoleLimitsSchema = z.object({
  maxTurns: z.number().int().min(1).max(200).default(30),
  timeoutSeconds: z.number().int().min(30).max(7200).default(1800),
  maxRetries: z.number().int().min(0).max(10).default(2)
});
export type RoleLimits = z.infer<typeof RoleLimitsSchema>;

export const AgentRoleInputSchema = z.object({
  projectId: z.string().uuid().nullable().default(null),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  promptTemplate: z.string().trim().min(1).max(20_000),
  providerId: z.string().trim().min(1).max(80).nullable().default(null),
  modelId: z.string().trim().min(1).max(120).nullable().default(null),
  capabilities: z.array(AgentCapabilitySchema).min(1),
  limits: RoleLimitsSchema,
  enabled: z.boolean().default(true)
}).superRefine((value, context) => {
  if ((value.providerId === null) !== (value.modelId === null)) context.addIssue({ code: "custom", message: "Provider and model must be assigned together" });
});
export type AgentRoleInput = z.infer<typeof AgentRoleInputSchema>;

export interface AgentRole extends AgentRoleInput {
  id: string; builtIn: boolean; createdAt: Date; updatedAt: Date;
}

export const builtInAgentRoles: readonly AgentRoleInput[] = [
  { projectId: null, slug: "senior-engineer", name: "Senior Engineer", description: "Plans architecture, resolves ambiguity, and reviews high-risk changes.", promptTemplate: "Act as the senior engineer. Clarify constraints, produce a bounded implementation plan, review evidence, and escalate unsafe or ambiguous decisions.", providerId: null, modelId: null, capabilities: ["plan", "review"], limits: { maxTurns: 30, timeoutSeconds: 1800, maxRetries: 2 }, enabled: true },
  { projectId: null, slug: "implementation-engineer", name: "Implementation Engineer", description: "Implements an approved plan inside the assigned worktree.", promptTemplate: "Implement the approved plan only inside the assigned worktree. Follow repository instructions, keep changes scoped, and report evidence and blockers.", providerId: null, modelId: null, capabilities: ["code", "test"], limits: { maxTurns: 50, timeoutSeconds: 3600, maxRetries: 2 }, enabled: true },
  { projectId: null, slug: "reviewer", name: "Reviewer", description: "Reviews diffs, risks, and requirement coverage independently.", promptTemplate: "Review the proposed changes independently. Prioritize correctness, security, regressions, missing tests, and deviations from the approved task.", providerId: null, modelId: null, capabilities: ["review"], limits: { maxTurns: 20, timeoutSeconds: 1200, maxRetries: 1 }, enabled: true },
  { projectId: null, slug: "tester", name: "Tester", description: "Runs approved automated and browser verification and records evidence.", promptTemplate: "Verify the implementation using approved commands and browser checks. Record reproducible evidence, failures, screenshots, and traces without modifying product behavior.", providerId: null, modelId: null, capabilities: ["test", "browser"], limits: { maxTurns: 25, timeoutSeconds: 1800, maxRetries: 2 }, enabled: true }
];
