import type { InstructionService } from "./instruction-service.js";
import type { AgentRoleRepository } from "../infrastructure/repositories/agent-role-repository.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";
import type { TaskRepository } from "../infrastructure/repositories/task-repository.js";
import type { WorkflowRepository } from "../infrastructure/repositories/workflow-repository.js";
import type { ApprovalKind, WorkflowStage } from "../domain/workflow.js";

const stages: WorkflowStage[] = [
  "plan",
  "implement",
  "review",
  "test",
  "delivery",
];
const roleForStage: Record<WorkflowStage, string | null> = {
  plan: "senior-engineer",
  implement: "implementation-engineer",
  review: "reviewer",
  test: "tester",
  delivery: null,
};
export class WorkflowService {
  constructor(
    private runs: WorkflowRepository,
    private tasks: TaskRepository,
    private projects: ProjectRepository,
    private roles: AgentRoleRepository,
    private instructions: InstructionService,
  ) {}
  list() {
    return this.runs.list();
  }
  get(id: string) {
    return this.runs.get(id);
  }
  steps(id: string) {
    return this.runs.steps(id);
  }
  approvals(id: string) {
    return this.runs.approvals(id);
  }
  plans(id: string) {
    return this.runs.plans(id);
  }
  interventions(id: string) {
    return this.runs.interventions(id);
  }
  recoverInterrupted() {
    return this.runs.recoverInterrupted();
  }
  async create(taskId: string) {
    const task = await this.tasks.get(taskId);
    if (!task.projectId)
      throw new Error("Assign the task to a project before creating a run");
    await this.projects.get(task.projectId);
    const run = await this.runs.create(taskId, task.projectId);
    const available = await this.roles.list(task.projectId);
    for (const [ordinal, stage] of stages.entries()) {
      const slug = roleForStage[stage];
      const role = slug
        ? available.find((value) => value.slug === slug && value.enabled)
        : null;
      if (slug && !role)
        throw new Error(`No enabled ${slug} role is available`);
      const effective = role
        ? await this.instructions.effective(role.id)
        : null;
      await this.runs.addStep(
        run.id,
        ordinal,
        stage,
        role?.id ?? null,
        effective
          ? {
              promptVersion: effective.prompt.version,
              content: effective.content,
              contentHash: effective.contentHash,
              skills: effective.skills.map((skill) => ({
                id: skill.id,
                version: skill.version,
                contentHash: skill.contentHash,
              })),
              warnings: effective.warnings,
            }
          : null,
      );
    }
    const approval = await this.runs.requestApproval(
      run.id,
      "start",
      "Review the exact roles, prompts, skills, and permissions before execution starts.",
    );
    await this.runs.setState(run.id, "awaiting_approval", null);
    return { run: await this.runs.get(run.id), approval };
  }
  async decide(approvalId: string, approved: boolean) {
    const decision = await this.runs.decide(approvalId, approved);
    if (decision.approval.kind === "plan") {
      const plan = (await this.runs.plans(decision.run.id)).find((value) => value.status === "awaiting_approval");
      if (plan) await this.runs.decidePlan(plan.id, approved ? "approved" : "changes_requested");
      if (!approved) {
        await this.runs.openIntervention(decision.run.id, "review", "Plan changes requested", "Revise the plan using the developer's feedback before implementation.");
        return this.runs.setState(decision.run.id, "paused", "plan", "Plan changes requested");
      }
    }
    if (!approved)
      return this.runs.setState(
        decision.run.id,
        "cancelled",
        null,
        `Developer rejected ${decision.approval.kind} approval`,
      );
    if (decision.approval.kind === "completion")
      return this.runs.setState(decision.run.id, "completed", null);
    const stage =
      decision.approval.kind === "start" ? "plan" : decision.run.currentStage;
    return this.runs.setState(decision.run.id, "running", stage);
  }
  approval(id: string) {
    return this.runs.approval(id);
  }
  async request(runId: string, kind: ApprovalKind, detail: string) {
    const run = await this.runs.get(runId);
    const approval = await this.runs.requestApproval(runId, kind, detail);
    await this.runs.setState(runId, "awaiting_approval", run.currentStage);
    return approval;
  }
  pause(id: string) {
    return this.runs.setState(id, "paused", null);
  }
  cancel(id: string) {
    return this.runs.setState(id, "cancelled", null);
  }
  async resume(id: string) {
    const run = await this.runs.get(id);
    if (run.status !== "paused" && run.status !== "failed")
      throw new Error(`Cannot resume a ${run.status} run`);
    const steps = await this.runs.steps(id);
    const next = steps.find(
      (step) => step.status === "pending" || step.status === "failed",
    );
    return this.runs.setState(id, "running", next?.stage ?? "delivery");
  }
  async fail(id: string, error: unknown) {
    const run = await this.runs.get(id);
    const detail = error instanceof Error ? error.message : String(error);
    return this.runs.setState(id, "failed", run.currentStage, detail);
  }
}
