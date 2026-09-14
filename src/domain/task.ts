import { z } from "zod";

export const taskSources = ["standup", "teams", "meeting", "support", "manual", "crm", "bug-tracker"] as const;
export const taskStatuses = ["captured", "assigned", "planned", "in_progress", "paused", "ready_to_complete", "sync_pending", "completed", "rejected"] as const;
export const evidenceKinds = ["note", "commit", "file", "test", "build", "link"] as const;

export const TaskSourceSchema = z.enum(taskSources);
export const TaskStatusSchema = z.enum(taskStatuses);
export const EvidenceKindSchema = z.enum(evidenceKinds);
export type TaskSource = z.infer<typeof TaskSourceSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const CaptureTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  source: TaskSourceSchema,
  assignmentDescription: z.string().trim().max(10_000).default(""),
  sourceReference: z.string().trim().max(2_000).optional(),
  assignedToMe: z.boolean().default(false),
  occurredAt: z.coerce.date().default(() => new Date())
  ,acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(50).default([])
});

export interface CaptureTask {
  title: string;
  source: TaskSource;
  sourceReference?: string | undefined;
  assignmentDescription?: string;
  assignedToMe?: boolean;
  occurredAt?: Date;
  acceptanceCriteria?: string[];
}

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  source: TaskSource;
  sourceReference: string | null;
  assignmentDescription: string;
  completionDescription: string | null;
  status: TaskStatus;
  assignedToMe: boolean;
  syncError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  acceptanceCriteria: string[];
  archivedAt: Date | null;
  deletedAt: Date | null;
}

const allowed: Record<TaskStatus, readonly TaskStatus[]> = {
  captured: ["assigned", "planned", "rejected"],
  assigned: ["planned", "rejected"],
  planned: ["in_progress", "rejected"],
  in_progress: ["paused", "ready_to_complete"],
  paused: ["in_progress", "ready_to_complete"],
  ready_to_complete: ["sync_pending"],
  sync_pending: ["completed", "sync_pending"],
  completed: [],
  rejected: []
};

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!allowed[from].includes(to)) throw new Error(`Invalid task transition: ${from} -> ${to}`);
}
