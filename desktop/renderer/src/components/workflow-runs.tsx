import { useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { workflowStageMessage } from "../../../../src/domain/workflow-messages";
import { Badge, Empty, Pagination, Panel } from "./ui";
import { RunInspector } from "./run-inspector";
import { usePagination } from "../hooks/use-pagination";
import { useRunActions } from "../hooks/use-run-actions";
import { pretty, projectName, taskName } from "../utils/presentation";

export function Runs({
  data,
  refresh,
  reviewTask,
  reviewTarget,
  confirm,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTask: (taskId: string) => void;
  reviewTarget?: { id: string; request: number } | null;
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}) {
  const [scope, setScope] = useState<"active" | "archived">("active");
  const visibleRuns = scope === "active" ? data.runs : data.archivedRuns;
  const runPage = usePagination(visibleRuns);
  const runs = useRunActions(data, refresh, confirm, reviewTarget ?? null, setScope);
  const selectedProject = data.projects.find(
    (project) => project.id === runs.details?.run?.projectId,
  );
  const automatedDelivery =
    selectedProject?.completionPolicy !== undefined &&
    selectedProject.completionPolicy !== "manual";
  return (
    <section className="stack">
      <div className="grid-two">
        <Panel title="Workflow Runs">
          <div className="segmented">
            <button
              className={scope === "active" ? "active" : ""}
              onClick={() => {
                setScope("active");
                runs.clear();
              }}
            >
              Active
            </button>
            <button
              className={scope === "archived" ? "active" : ""}
              onClick={() => {
                setScope("archived");
                runs.clear();
              }}
            >
              Archived
            </button>
          </div>
          {visibleRuns.length ? (
            runPage.items.map((run) => (
              <button
                className={`run-row ${runs.selected === run.id ? "selected" : ""}`}
                key={run.id}
                onClick={() => void runs.open(run.id)}
              >
                <span>
                  <strong>{taskName(data, run.taskId)}</strong>
                  <small>
                    {workflowStageMessage(run.currentStage, "name")} ·{" "}
                    {run.error
                      ? "Needs attention. Open this run for details."
                      : projectName(data, run.projectId)}
                  </small>
                </span>
                <Badge
                  text={
                    run.id === runs.selected && runs.executingStage
                      ? workflowStageMessage(runs.executingStage, "running")
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
              title="No Workflow Runs"
              copy="Open a task and create a run after configuring its roles and provider."
            />
          )}
          <Pagination {...runPage} label="runs" />
        </Panel>
        <RunInspector
          data={data}
          details={runs.details}
          scope={scope}
          busy={runs.busy}
          executingStage={runs.executingStage}
          executionSeconds={runs.executionSeconds}
          automatedDelivery={automatedDelivery}
          reviewTask={reviewTask}
          onAction={(runId, action) => void runs.action(runId, action)}
          onRemove={(runId, action) => void runs.remove(runId, action)}
          onGit={(runId, action, commitMessage) => void runs.git(runId, action, commitMessage)}
          onAllowProviderAndResume={(runId, projectId) =>
            void runs.allowProviderAndResume(runId, projectId)
          }
          onOpen={(runId) => void runs.open(runId)}
        />
      </div>
    </section>
  );
}
