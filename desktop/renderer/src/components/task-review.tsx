import { workflowStageMessage } from "../../../../src/domain/workflow-messages";
import { Badge, Panel } from "./ui";
import { pretty } from "../utils/presentation";

export function TaskReview({
  details,
  completionDraft,
  setCompletionDraft,
  reviewBusy,
  saveReview,
  finishReview,
  close,
}: {
  details: any;
  completionDraft: string;
  setCompletionDraft: (value: string) => void;
  reviewBusy: boolean;
  saveReview: () => Promise<void>;
  finishReview: () => Promise<void>;
  close: () => void;
}) {
  return (
    <div id="task-review">
      <Panel title={`Task details · ${details.task.title}`}>
        {details.workflow?.run.status === "completed" &&
          details.task.status !== "completed" && (
            <div className="completion-review">
              <div className="completion-review-head">
                <Badge text="Agent run complete" />
                <strong>Your review is the final step</strong>
              </div>
              <p>
                The agents have finished, but this task remains open until you review the evidence,
                save a completion summary, and choose to mark it complete.
              </p>
            </div>
          )}
        {details.workflow && (
          <div className="cockpit">
            <div className="cockpit-head">
              <div>
                <small>Workflow</small>
                <strong>
                  {details.workflow.run.status === "running"
                    ? "AwenesOS is working"
                    : pretty(details.workflow.run.status)}
                </strong>
              </div>
              <Badge
                text={pretty(
                  details.workflow.run.currentStage ?? "not started",
                )}
              />
            </div>
            <div className="stage-track">
              {details.workflow.steps.map((step: any) => (
                <div key={step.id} data-state={step.status}>
                  <span>
                    {step.status === "passed"
                      ? "✓"
                      : step.status === "running"
                        ? "●"
                        : "○"}
                  </span>
                  <small>{workflowStageMessage(step.stage, "name")}</small>
                </div>
              ))}
            </div>
            {details.workflow.plans?.[0] && (
              <details
                className="plan-details"
                open={
                  details.workflow.plans[0].status === "awaiting_approval"
                }
              >
                <summary>
                  Plan v{details.workflow.plans[0].version} ·{" "}
                  {pretty(details.workflow.plans[0].status)}
                </summary>
                <pre>{details.workflow.plans[0].content}</pre>
              </details>
            )}
            {details.workflow.interventions
              ?.filter((item: any) => item.status === "open")
              .map((item: any) => (
                <div className="intervention" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
          </div>
        )}
        <div className="summary-grid">
          <div>
            <small>Active work</small>
            <strong>{details.duration.active}</strong>
          </div>
          <div>
            <small>Paused</small>
            <strong>{details.duration.paused}</strong>
          </div>
          <div>
            <small>Total elapsed</small>
            <strong>{details.duration.calendar}</strong>
          </div>
          <div>
            <small>Evidence</small>
            <strong>{details.evidence.length}</strong>
          </div>
        </div>
        {details.task.assignmentDescription && (
          <p>{details.task.assignmentDescription}</p>
        )}
        {details.evidence.map((item: any) => (
          <div className="row" key={item.id}>
            <span>{pretty(item.kind)}</span>
            <small>{item.value}</small>
          </div>
        ))}
        {details.workflow?.run.status === "completed" && (
          <div className="completion-evidence">
            <h3>Agent evidence</h3>
            {details.workflow.steps
              .filter((step: any) => step.output)
              .map((step: any) => (
                <details key={step.id}>
                  <summary>{workflowStageMessage(step.stage, "name")} · {pretty(step.status)}</summary>
                  <pre>{step.output}</pre>
                </details>
              ))}
            {details.workflow.delivery?.review && (
              <details>
                <summary>Git diff review</summary>
                <pre>{details.workflow.delivery.review.diff || "No uncommitted changes in this worktree."}</pre>
              </details>
            )}
            {details.workflow.browserEvidence?.length > 0 && (
              <details>
                <summary>Browser validation ({details.workflow.browserEvidence.length})</summary>
                <pre>{JSON.stringify(details.workflow.browserEvidence, null, 2)}</pre>
              </details>
            )}
            {!details.evidence.length && (
              <p className="muted">No separate task evidence has been recorded. Inspect the agent outputs before completing this task.</p>
            )}
          </div>
        )}
        {details.workflow?.run.status === "completed" &&
          ["in_progress", "paused", "ready_to_complete"].includes(details.task.status) && (
            <div className="completion-review">
              <h3>Completion summary</h3>
              <p>Review and edit this draft. Saving it does not mark the task complete.</p>
              <label>
                What was completed and verified?
                <textarea
                  rows={8}
                  value={completionDraft}
                  onChange={(event) => setCompletionDraft(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button
                  className="ghost"
                  disabled={reviewBusy || !completionDraft.trim()}
                  onClick={() => void saveReview()}
                >
                  {details.task.status === "ready_to_complete" ? "Save changes" : "Save review"}
                </button>
                <button
                  className="primary"
                  disabled={reviewBusy || details.task.status !== "ready_to_complete" ||
                    completionDraft.trim() !== (details.task.completionDescription ?? "").trim()}
                  title={details.task.status !== "ready_to_complete"
                    ? "Save the completion review first"
                    : "Save any edits before finishing"}
                  onClick={() => void finishReview()}
                >
                  Mark task complete
                </button>
              </div>
            </div>
          )}
        <button className="ghost" onClick={close}>
          Close details
        </button>
      </Panel>
    </div>
  );
}
