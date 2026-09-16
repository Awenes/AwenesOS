import type { WorkflowStage } from "./workflow.js";

const messages: Record<WorkflowStage, { name: string; running: string; action: string }> = {
  plan: { name: "Plan", running: "Creating a plan", action: "Create the plan" },
  implement: { name: "Implementation", running: "Making changes", action: "Make the changes" },
  review: { name: "Review", running: "Checking the changes", action: "Review the changes" },
  test: { name: "Tests", running: "Running checks", action: "Run the checks" },
  delivery: { name: "Delivery", running: "Preparing delivery", action: "Prepare delivery" },
};

export function workflowStageMessage(stage: string | null, mode: "name" | "running" | "action") {
  return stage && Object.prototype.hasOwnProperty.call(messages, stage) ? messages[stage as WorkflowStage][mode] : mode === "running" ? "Preparing the task" : mode === "action" ? "Continue run" : "Task";
}
