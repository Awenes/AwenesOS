import type { DesktopSnapshot } from "../../../contracts";
import { workflowStageMessage } from "../../../../src/domain/workflow-messages";
import type { WorkflowStage } from "../../../../src/domain/workflow";
import { Badge, Empty, Panel } from "./ui";
import { pretty, taskName } from "../utils/presentation";
import type { RunAction } from "../hooks/use-run-actions";

export function RunInspector({
  data,
  details,
  scope,
  busy,
  executingStage,
  executionSeconds,
  automatedDelivery,
  reviewTask,
  onAction,
  onRemove,
  onGit,
  onAllowProviderAndResume,
  onOpen,
}: {
  data: DesktopSnapshot;
  details: any;
  scope: "active" | "archived";
  busy: boolean;
  executingStage: WorkflowStage | null;
  executionSeconds: number;
  automatedDelivery: boolean;
  reviewTask: (taskId: string) => void;
  onAction: (runId: string, action: RunAction) => void;
  onRemove: (runId: string, action: "archive" | "restore" | "delete") => void;
  onGit: (runId: string, action: "review" | "commit" | "push", commitMessage?: string) => void;
  onAllowProviderAndResume: (runId: string, projectId: string) => void;
  onOpen: (runId: string) => void;
}) {
  return (
    <Panel title="Run Inspector">
      {!details ? (
        <Empty
          title="Select a Run"
          copy="Inspect snapshotted instructions, attempts, approvals, evidence, and delivery."
        />
      ) : (
        <>
          {details.run.status === "failed" && (
            <div className="setup-error" role="alert">
              <strong>This run stopped before finishing.</strong>
              <p>
                {/Network access denied|Command is not allowed/i.test(details.run.error ?? "")
                  ? "Review the project's permissions, then retry the run."
                  : /ENOENT|not found/i.test(details.run.error ?? "")
                    ? "Check that the required command or file is installed and available, then retry."
                    : "Review the failed step and retry when the issue is resolved."}
              </p>
              {details.run.error && (
                <details>
                  <summary>Technical details</summary>
                  <pre>{details.run.error}</pre>
                </details>
              )}
            </div>
          )}
          {details.run.status === "completed" &&
            data.tasks.some(
              (task) => task.id === details.run.taskId && task.status !== "completed",
            ) && (
              <div className="completion-review">
                <strong>Agent run complete · Task still open</strong>
                <p>Review the evidence and completion summary before marking the task complete.</p>
                <button className="primary" onClick={() => reviewTask(details.run.taskId)}>
                  Review task completion →
                </button>
              </div>
            )}
          <div className="run-actions">
            {scope === "active" && ["failed", "completed", "cancelled"].includes(details.run.status) && (
              <button className="ghost" disabled={busy} onClick={() => onRemove(details.run.id, "archive")}>
                Archive
              </button>
            )}
            {scope === "archived" && (
              <button className="ghost" disabled={busy} onClick={() => onRemove(details.run.id, "restore")}>
                Restore
              </button>
            )}
            {["failed", "completed", "cancelled"].includes(details.run.status) && (
              <button className="danger" disabled={busy} onClick={() => onRemove(details.run.id, "delete")}>
                Delete
              </button>
            )}
            {details.run.status === "failed" &&
              /Network access denied|Command is not allowed/.test(details.run.error ?? "") && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => onAllowProviderAndResume(details.run.id, details.run.projectId)}
                >
                  Allow provider access and retry
                </button>
              )}
            <button
              disabled={busy || details.run.status !== "running"}
              onClick={() => onAction(details.run.id, "next")}
            >
              {executingStage
                ? `${workflowStageMessage(executingStage, "running")}… ${executionSeconds}s`
                : workflowStageMessage(details.run.currentStage, "action")}
            </button>
            <button
              disabled={busy || !["running", "awaiting_approval"].includes(details.run.status)}
              onClick={() => onAction(details.run.id, "pause")}
            >
              Pause
            </button>
            <button
              disabled={busy || !["paused", "failed"].includes(details.run.status)}
              onClick={() => onAction(details.run.id, "resume")}
            >
              Resume
            </button>
            <button
              disabled={busy || ["completed", "cancelled"].includes(details.run.status)}
              onClick={() => onAction(details.run.id, "cancel")}
            >
              Cancel
            </button>
          </div>
          {details.steps.map((step: any) => (
            <div className="row" key={step.id}>
              <div>
                <strong>{workflowStageMessage(step.stage, "name")}</strong>
                <small>
                  Attempt {step.attempt}
                  {step.output ? ` · ${String(step.output).slice(0, 90)}` : ""}
                </small>
              </div>
              <Badge text={pretty(step.status)} />
            </div>
          ))}
          <div className="run-actions">
            <button
              disabled={busy || !details.browserConfigured}
              title={
                details.browserConfigured
                  ? "Run the saved localhost browser validation"
                  : "Configure localhost browser testing in Safety first"
              }
              onClick={() => void window.awenes.runBrowserTest(details.run.id).then(() => onOpen(details.run.id))}
            >
              {details.browserConfigured ? "Run browser test" : "Browser test not configured"}
            </button>
            <button disabled={busy} onClick={() => onGit(details.run.id, "review")}>
              Review diff
            </button>
            {automatedDelivery && (
              <>
                <button
                  disabled={busy || !details.delivery?.review?.status}
                  title={
                    details.delivery?.review?.status
                      ? "Commit the reviewed changes"
                      : "Review a non-empty diff before committing"
                  }
                  onClick={() =>
                    onGit(details.run.id, "commit", `feat: complete ${taskName(data, details?.run?.taskId)}`)
                  }
                >
                  Commit
                </button>
                <button
                  disabled={busy || !details.delivery?.commitSha}
                  title={
                    details.delivery?.commitSha
                      ? "Push the approved commit"
                      : "Commit the reviewed changes before pushing"
                  }
                  onClick={() => onGit(details.run.id, "push")}
                >
                  Push after approval
                </button>
              </>
            )}
          </div>
          {!details.browserConfigured && (
            <p className="muted">
              Browser validation becomes available after its localhost settings are saved in Safety.
            </p>
          )}
          {!automatedDelivery && (
            <p className="muted">
              This project uses manual delivery. Review remains available, while you control Git
              commit and push outside AwenesOS.
            </p>
          )}
          {details.delivery?.review && (
            <pre>
              {details.delivery.review.status
                ? `${details.delivery.review.diffStat}\n${details.delivery.review.diff}`
                : "No uncommitted changes were found in this task worktree."}
            </pre>
          )}
        </>
      )}
    </Panel>
  );
}
