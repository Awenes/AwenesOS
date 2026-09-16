import type { AgentRunner } from "../domain/agent-runner.js";
import type { ExecutionPolicy, TaskWorktree } from "../domain/project.js";
import type { ProviderConnection } from "../domain/provider.js";
import type { AgentRoleRepository } from "../infrastructure/repositories/agent-role-repository.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";
import type { ProviderRepository } from "../infrastructure/repositories/provider-repository.js";
import type { TaskRepository } from "../infrastructure/repositories/task-repository.js";
import type { WorkflowRepository } from "../infrastructure/repositories/workflow-repository.js";
import type { WorktreeService } from "./worktree-service.js";
import { ExecutionGuard } from "./execution-guard.js";
export interface AgentRunnerFactory {
  create(
    provider: ProviderConnection,
    worktree: TaskWorktree,
    policy: ExecutionPolicy,
  ): AgentRunner;
}
export class WorkflowEngine {
  constructor(
    private runs: WorkflowRepository,
    private tasks: TaskRepository,
    private projects: ProjectRepository,
    private roles: AgentRoleRepository,
    private providers: ProviderRepository,
    private worktrees: WorktreeService,
    private agents: AgentRunnerFactory,
  ) {}
  async executeNext(runId: string) {
    const run = await this.runs.get(runId);
    if (run.status !== "running")
      throw new Error(`Run must be running, not ${run.status}`);
    const steps = await this.runs.steps(runId);
    const step = steps.find(
      (value) => value.status === "pending" || value.status === "failed",
    );
    if (!step) return this.runs.setState(runId, "completed", null);
    if (step.stage === "delivery") {
      const project = await this.projects.get(run.projectId);
      const policy = await this.projects.executionPolicy(run.projectId);
      if (
        project.completionPolicy === "auto_push" &&
        !policy.requirePushApproval
      )
        return this.runs.setState(runId, "running", "delivery");
      const kind =
        project.completionPolicy === "manual" ? "completion" : "push";
      await this.runs.requestApproval(
        runId,
        kind,
        kind === "push"
          ? "Review the diff and approve Git push."
          : "Review all evidence and complete delivery manually.",
      );
      return this.runs.setState(runId, "awaiting_approval", "delivery");
    }
    if (!step.roleId) throw new Error(`No role assigned to ${step.stage}`);
    const role = await this.roles.get(step.roleId);
    if (!role.providerId || !role.modelId)
      throw new Error(`${role.name} needs a provider and model`);
    const provider = await this.providers.get(role.providerId);
    if (provider.status !== "ready")
      throw new Error(`${provider.name} is not ready`);
    if (step.attempt > role.limits.maxRetries) {
      return this.runs.setState(
        runId,
        "failed",
        step.stage,
        `${step.stage} exceeded its retry limit`,
      );
    }
    const task = await this.tasks.get(run.taskId);
    const project = await this.projects.get(run.projectId);
    let policy = await this.projects.executionPolicy(run.projectId);
    if (policy.autoGrantAgentAccess) {
      const command = provider.command?.trim();
      const needsNetwork = policy.networkAccess !== "public";
      const needsCommand = Boolean(
        command && !policy.commandAllowlist.includes(command),
      );
      if (needsNetwork || needsCommand)
        policy = await this.projects.saveExecutionPolicy(run.projectId, {
          ...policy,
          networkAccess: "public",
          commandAllowlist: command
            ? [...new Set([...policy.commandAllowlist, command])]
            : policy.commandAllowlist,
        });
    }
    new ExecutionGuard(project.repositoryRoot, policy).assertNetwork("public");
    const worktree = await this.worktrees.create(task.id);
    const snapshot = step.instructionSnapshot as { content?: string } | null;
    await this.runs.startStep(step.id);
    try {
      const result = await this.agents.create(provider, worktree, policy).run({
        provider,
        modelId: role.modelId,
        instructions: snapshot?.content ?? role.promptTemplate,
        taskTitle: task.title,
        taskDescription: task.assignmentDescription,
        stage: step.stage,
        worktreePath: worktree.path,
        timeoutSeconds: role.limits.timeoutSeconds,
        maxTurns: role.limits.maxTurns,
        capabilities: role.capabilities,
      });
      await this.runs.finishStep(
        step.id,
        result.success,
        result.transcript || result.summary,
      );
      const currentRun = await this.runs.get(runId);
      if (currentRun.status === "paused") return currentRun;
      if (!result.success)
        return this.runs.setState(runId, "failed", step.stage, result.summary);
      if (step.stage === "plan") {
        const requiresApproval = project.autonomyMode !== "autonomous";
        const plan = await this.runs.createPlan(
          runId,
          result.transcript || result.summary,
          requiresApproval,
        );
        if (requiresApproval) {
          await this.runs.requestApproval(
            runId,
            "plan",
            `Review plan version ${plan.version} before implementation begins.`,
          );
          return this.runs.setState(runId, "awaiting_approval", "plan");
        }
      }
      const refreshed = await this.runs.steps(runId);
      const next = refreshed.find(
        (value) => value.status === "pending" || value.status === "failed",
      );
      return this.runs.setState(runId, "running", next?.stage ?? null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await this.runs.finishStep(step.id, false, detail);
      return this.runs.setState(runId, "failed", step.stage, detail);
    }
  }
}
