import type { Task, TaskStatus } from "./task.js";
import type { ApprovalKind, WorkflowRunStatus, WorkflowStage, WorkflowStepStatus } from "./workflow.js";
import { workflowStageMessage } from "./workflow-messages.js";

export type TaskExperienceState =
  | "draft" | "preparing" | "working" | "needs_input" | "ready_for_review"
  | "awaiting_push_approval" | "external_update_required" | "complete"
  | "failed" | "paused" | "archived" | "deleted";

export interface TaskExperience {
  state: TaskExperienceState;
  stage: WorkflowStage | null;
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

export function deriveTaskExperience(input: {
  task: Pick<Task, "status" | "archivedAt" | "deletedAt">;
  run?: { status: WorkflowRunStatus; currentStage: WorkflowStage | null } | null;
  stepStatus?: WorkflowStepStatus | null;
  approvalKind?: ApprovalKind | null;
  hasOpenIntervention?: boolean;
}): TaskExperience {
  const { task, run, stepStatus, approvalKind, hasOpenIntervention } = input;
  if (task.deletedAt) return experience("deleted", null, "Deleted", "neutral");
  if (task.archivedAt) return experience("archived", null, "Archived", "neutral");
  if (task.status === "completed") return experience("complete", null, "Complete", "success");
  if (task.status === "sync_pending") return experience("external_update_required", null, "External update required", "warning");
  if (hasOpenIntervention) return experience("needs_input", run?.currentStage ?? null, "Needs your input", "warning");
  if (!run) return experience("draft", null, taskLabel(task.status), "neutral");
  if (run.status === "failed") return experience("failed", run.currentStage, "Failed", "danger");
  if (run.status === "paused") return experience("paused", run.currentStage, "Paused", "neutral");
  if (run.status === "completed") return experience("ready_for_review", null, "Ready for review", "success");
  if (run.status === "awaiting_approval") {
    if (approvalKind === "push") return experience("awaiting_push_approval", run.currentStage, "Awaiting push approval", "warning");
    return experience("needs_input", run.currentStage, approvalKind === "plan" ? "Plan ready for approval" : "Needs your input", "warning");
  }
  if (run.status === "running" && stepStatus === "running")
    return experience("working", run.currentStage, workflowStageMessage(run.currentStage, "running"), "info");
  return experience("preparing", run.currentStage, "Preparing", "info");
}

function experience(state: TaskExperienceState, stage: WorkflowStage | null, label: string, tone: TaskExperience["tone"]): TaskExperience { return { state, stage, label, tone }; }
function taskLabel(status: TaskStatus) { return status === "paused" ? "Paused" : status === "ready_to_complete" ? "Ready for review" : "Draft"; }
