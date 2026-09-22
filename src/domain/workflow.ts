import { z } from "zod";

export const WorkflowStageSchema = z.enum([
  "plan",
  "implement",
  "review",
  "test",
  "delivery",
]);
export const WorkflowRunStatusSchema = z.enum([
  "created",
  "running",
  "awaiting_approval",
  "paused",
  "failed",
  "completed",
  "cancelled",
]);
export const WorkflowStepStatusSchema = z.enum([
  "pending",
  "running",
  "passed",
  "failed",
  "skipped",
]);
export const ApprovalKindSchema = z.enum([
  "start",
  "public_network",
  "browser_credentials",
  "commit",
  "push",
  "completion",
  "plan",
  "stage",
]);
export const InterventionKindSchema = z.enum(["setup", "question", "permission", "failure", "review"]);
export type InterventionKind = z.infer<typeof InterventionKindSchema>;
export interface WorkflowPlan { id: string; runId: string; version: number; content: string; status: "draft" | "awaiting_approval" | "approved" | "changes_requested"; createdAt: Date; decidedAt: Date | null; }
export interface WorkflowIntervention { id: string; runId: string; kind: InterventionKind; title: string; detail: string; status: "open" | "resolved"; createdAt: Date; resolvedAt: Date | null; }
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;
export interface WorkflowRun {
  id: string;
  taskId: string;
  projectId: string;
  status: WorkflowRunStatus;
  currentStage: WorkflowStage | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
}
export interface WorkflowStep {
  id: string;
  runId: string;
  ordinal: number;
  stage: WorkflowStage;
  roleId: string | null;
  status: WorkflowStepStatus;
  attempt: number;
  instructionSnapshot: Record<string, unknown> | null;
  output: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}
export interface Approval {
  id: string;
  runId: string;
  kind: ApprovalKind;
  status: "pending" | "approved" | "rejected";
  detail: string;
  requestedAt: Date;
  decidedAt: Date | null;
}
