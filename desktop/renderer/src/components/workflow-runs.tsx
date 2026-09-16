import { useEffect, useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { workflowStageMessage } from "../../../../src/domain/workflow-messages";
import type { WorkflowStage } from "../../../../src/domain/workflow";
import { Badge, Empty, Pagination, Panel } from "./ui";
import { usePagination } from "../hooks/use-pagination";
import { pretty, projectName, taskName } from "../utils/presentation";

export function Runs({
  data,
  refresh,
  reviewTask,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTask: (taskId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [executingStage, setExecutingStage] = useState<WorkflowStage | null>(null);
  const [executionSeconds, setExecutionSeconds] = useState(0);
  const visibleRuns = scope === "active" ? data.runs : data.archivedRuns;
  const runPage = usePagination(visibleRuns);
  const selectedProject = data.projects.find(
    (project) => project.id === details?.run?.projectId,
  );
  const automatedDelivery =
    selectedProject?.completionPolicy !== undefined &&
    selectedProject.completionPolicy !== "manual";
  useEffect(() => {
    if (!executingStage) return;
    setExecutionSeconds(0);
    const timer = window.setInterval(
      () => setExecutionSeconds((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [executingStage]);
  async function open(id: string) {
    setSelected(id);
    setDetails(await window.awenes.runDetails(id));
  }
  async function action(
    runId: string,
    action: "next" | "pause" | "resume" | "cancel" | "archive" | "restore" | "delete",
  ) {
    setBusy(true);
    if (action === "next")
      setExecutingStage(details?.run.currentStage ?? null);
    try {
      await window.awenes.runAction({ runId, action });
      await refresh();
      await open(runId);
    } finally {
      setExecutingStage(null);
      setBusy(false);
    }
  }
  async function remove(runId: string, action: "archive" | "restore" | "delete") {
    if (action === "delete" && !window.confirm("Delete this run? Its audit tombstone will be retained.")) return;
    setBusy(true);
    try {
      await window.awenes.runAction({ runId, action });
      setSelected(null);
      setDetails(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function git(runId: string, action: "review" | "commit" | "push") {
    setBusy(true);
    try {
      if (action === "review")
        setDetails({
          ...details,
          delivery: await window.awenes.gitReview(runId),
        });
      else if (action === "commit")
        await window.awenes.gitCommit({
          runId,
          message: `feat: complete ${taskName(data, details?.run?.taskId)}`,
        });
      else await window.awenes.gitPush(runId);
      await refresh();
      await open(runId);
    } finally {
      setBusy(false);
    }
  }
  async function allowProviderAndResume(runId: string, projectId: string) {
    setBusy(true);
    try {
      const policy = await window.awenes.executionPolicy(projectId);
      const providerCommands = data.providers
        .filter((provider) => provider.status === "ready" && provider.command)
        .map((provider) => provider.command!);
      await window.awenes.saveExecutionPolicy({
        projectId,
        policy: {
          ...policy,
          networkAccess: "public",
          commandAllowlist: [
            ...new Set([...policy.commandAllowlist, ...providerCommands]),
          ],
          environmentAllowlist: [
            ...new Set([
              ...policy.environmentAllowlist,
              "PATH",
              "Path",
              "PATHEXT",
              "SystemRoot",
            ]),
          ],
        },
      });
      await window.awenes.runAction({ runId, action: "resume" });
      await refresh();
      await open(runId);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack">
      <div className="grid-two">
        <Panel title="Workflow runs">
          <div className="segmented">
            <button className={scope === "active" ? "active" : ""} onClick={() => { setScope("active"); setSelected(null); setDetails(null); }}>Active</button>
            <button className={scope === "archived" ? "active" : ""} onClick={() => { setScope("archived"); setSelected(null); setDetails(null); }}>Archived</button>
          </div>
          {visibleRuns.length ? (
            runPage.items.map((run) => (
              <button
                className={`run-row ${selected === run.id ? "selected" : ""}`}
                key={run.id}
                onClick={() => void open(run.id)}
              >
                <span>
                  <strong>{taskName(data, run.taskId)}</strong>
                  <small>
                    {workflowStageMessage(run.currentStage, "name")} ·{" "}
                    {run.error ? "Needs attention. Open this run for details." : projectName(data, run.projectId)}
                  </small>
                </span>
                <Badge
                  text={
                    run.id === selected && executingStage
                      ? workflowStageMessage(executingStage, "running")
                      : run.status === "running"
                        ? run.stepStatus === "running"
                          ? workflowStageMessage(run.currentStage, "running")
                          : "Preparing"
                        : pretty(run.status)
                  }
                />
              </button>
            ))
          ) : (
            <Empty
              title="No workflow runs"
              copy="Open a task and create a run after configuring its roles and provider."
            />
          )}
          <Pagination {...runPage} label="runs" />
        </Panel>
        <Panel title="Run inspector">
          {!details ? (
            <Empty
              title="Select a run"
              copy="Inspect snapshotted instructions, attempts, approvals, evidence, and delivery."
            />
          ) : (
            <>
              {details.run.status === "failed" && <div className="setup-error" role="alert">
                <strong>This run stopped before finishing.</strong>
                <p>{/Network access denied|Command is not allowed/i.test(details.run.error ?? "") ? "Review the project's permissions, then retry the run." : /ENOENT|not found/i.test(details.run.error ?? "") ? "Check that the required command or file is installed and available, then retry." : "Review the failed step and retry when the issue is resolved."}</p>
                {details.run.error && <details><summary>Technical details</summary><pre>{details.run.error}</pre></details>}
              </div>}
              {details.run.status === "completed" &&
                data.tasks.some((task) =>
                  task.id === details.run.taskId && task.status !== "completed",
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
                  <button className="ghost" disabled={busy} onClick={() => void remove(details.run.id, "archive")}>Archive</button>
                )}
                {scope === "archived" && (
                  <button className="ghost" disabled={busy} onClick={() => void remove(details.run.id, "restore")}>Restore</button>
                )}
                {["failed", "completed", "cancelled"].includes(details.run.status) && (
                  <button className="danger" disabled={busy} onClick={() => void remove(details.run.id, "delete")}>Delete</button>
                )}
                {details.run.status === "failed" &&
                  /Network access denied|Command is not allowed/.test(
                    details.run.error ?? "",
                  ) && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void allowProviderAndResume(
                          details.run.id,
                          details.run.projectId,
                        )
                      }
                    >
                      Allow provider access and retry
                    </button>
                  )}
                <button
                  disabled={busy || details.run.status !== "running"}
                  onClick={() => void action(details.run.id, "next")}
                >
                  {executingStage
                    ? `${workflowStageMessage(executingStage, "running")}… ${executionSeconds}s`
                    : workflowStageMessage(details.run.currentStage, "action")}
                </button>
                <button
                  disabled={busy || !["running", "awaiting_approval"].includes(details.run.status)}
                  onClick={() => void action(details.run.id, "pause")}
                >
                  Pause
                </button>
                <button
                  disabled={busy || !["paused", "failed"].includes(details.run.status)}
                  onClick={() => void action(details.run.id, "resume")}
                >
                  Resume
                </button>
                <button
                  disabled={busy || ["completed", "cancelled"].includes(details.run.status)}
                  onClick={() => void action(details.run.id, "cancel")}
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
                      {step.output
                        ? ` · ${String(step.output).slice(0, 90)}`
                        : ""}
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
                  onClick={() =>
                    void window.awenes
                      .runBrowserTest(details.run.id)
                      .then(() => open(details.run.id))
                  }
                >
                  {details.browserConfigured
                    ? "Run browser test"
                    : "Browser test not configured"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void git(details.run.id, "review")}
                >
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
                      onClick={() => void git(details.run.id, "commit")}
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
                      onClick={() => void git(details.run.id, "push")}
                    >
                      Push after approval
                    </button>
                  </>
                )}
              </div>
              {!details.browserConfigured && (
                <p className="muted">
                  Browser validation becomes available after its localhost
                  settings are saved in Safety.
                </p>
              )}
              {!automatedDelivery && (
                <p className="muted">
                  This project uses manual delivery. Review remains available,
                  while you control Git commit and push outside AwenesOS.
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
      </div>
    </section>
  );
}

