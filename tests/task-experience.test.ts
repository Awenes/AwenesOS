import { describe, expect, it } from "vitest";
import { deriveTaskExperience } from "../src/domain/task-experience.js";

const task = { status: "in_progress" as const, archivedAt: null, deletedAt: null };
describe("task experience state", () => {
  it("only reports working when a workflow step is actually executing", () => {
    expect(deriveTaskExperience({ task, run: { status: "running", currentStage: "plan" }, stepStatus: "pending" }).label).toBe("Preparing");
    expect(deriveTaskExperience({ task, run: { status: "running", currentStage: "plan" }, stepStatus: "running" }).label).toBe("Working: Plan");
  });
  it("prioritizes interventions and external confirmation", () => {
    expect(deriveTaskExperience({ task, run: { status: "running", currentStage: "implement" }, hasOpenIntervention: true }).state).toBe("needs_input");
    expect(deriveTaskExperience({ task: { ...task, status: "sync_pending" } }).state).toBe("external_update_required");
  });
  it("distinguishes plan and push approvals", () => {
    const run = { status: "awaiting_approval" as const, currentStage: "plan" as const };
    expect(deriveTaskExperience({ task, run, approvalKind: "plan" }).label).toBe("Plan ready for approval");
    expect(deriveTaskExperience({ task, run: { ...run, currentStage: "delivery" }, approvalKind: "push" }).state).toBe("awaiting_push_approval");
  });
});
