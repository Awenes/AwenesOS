import type { DesktopSnapshot } from "../../../contracts";
import { Badge } from "./ui";
import { OverflowMenu } from "./overflow-menu";
import { pretty, projectName } from "../utils/presentation";

type TaskAction =
  | "confirm"
  | "claim"
  | "reject"
  | "start"
  | "pause"
  | "resume"
  | "archive"
  | "restore"
  | "delete";

export function TaskRow({
  task,
  data,
  scope,
  onOpen,
  onAction,
  refresh,
  confirm,
}: {
  task: DesktopSnapshot["tasks"][number];
  data: DesktopSnapshot;
  scope: "active" | "archived";
  onOpen: (taskId: string) => void;
  onAction: (taskId: string, action: TaskAction) => Promise<void>;
  refresh: () => Promise<void>;
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}) {
  const hasCompletedRun = data.runs.some(
    (run) => run.taskId === task.id && run.status === "completed",
  );
  return (
    <div className="task-row">
      <div className="task-status" data-status={task.status} />
      <div className="grow">
        <strong>{task.title}</strong>
        <small>
          {projectName(data, task.projectId)} · {pretty(task.source)}
        </small>
      </div>
      <div className="task-row-actions">
        <Badge
          text={
            hasCompletedRun && ["in_progress", "paused"].includes(task.status)
              ? "Ready for review"
              : pretty(task.status)
          }
        />
        <button className="small-button" onClick={() => onOpen(task.id)}>
          Details
        </button>
        {hasCompletedRun &&
          ["in_progress", "paused", "ready_to_complete"].includes(task.status) && (
            <button className="primary" onClick={() => onOpen(task.id)}>
              Review & finish
            </button>
          )}
        {task.projectId &&
          !data.runs.some((run) => run.taskId === task.id) &&
          ["planned", "in_progress", "paused"].includes(task.status) && (
            <button
              className="small-button"
              onClick={async () => {
                await window.awenes.createRun(task.id);
                await refresh();
              }}
            >
              Create run
            </button>
          )}
        {task.status === "captured" && (
          <button
            className="small-button"
            title="Confirm this was assigned to you, without claiming it as active work yet"
            onClick={() => void onAction(task.id, "confirm")}
          >
            Confirm
          </button>
        )}
        {task.status === "captured" && (
          <button
            className="small-button"
            title="Remove this task from the inbox; it is not deleted and can be reviewed in history"
            onClick={() => void onAction(task.id, "reject")}
          >
            Reject
          </button>
        )}
        {(task.status === "captured" || task.status === "assigned") && (
          <button
            className="small-button"
            title="Claim this as active work and move it to planning"
            onClick={() => void onAction(task.id, "claim")}
          >
            Claim
          </button>
        )}
        {task.status === "planned" && (
          <button
            className="small-button"
            onClick={() => void onAction(task.id, "start")}
          >
            Start
          </button>
        )}
        {task.status === "in_progress" && (
          <button
            className="small-button"
            onClick={() => void onAction(task.id, "pause")}
          >
            Pause
          </button>
        )}
        {task.status === "paused" && (
          <button
            className="small-button"
            onClick={() => void onAction(task.id, "resume")}
          >
            Resume
          </button>
        )}
        {["in_progress", "paused"].includes(task.status) && !hasCompletedRun && (
          <button
            className="small-button"
            onClick={async () => {
              const description = window.prompt(
                "Completion description (leave blank to draft from evidence)",
              );
              await window.awenes.taskCompletion({
                taskId: task.id,
                action: "prepare",
                ...(description ? { description } : {}),
              });
              await refresh();
            }}
          >
            Prepare completion
          </button>
        )}
        {task.status === "ready_to_complete" && !hasCompletedRun && (
          <button
            className="primary"
            onClick={async () => {
              await window.awenes.taskCompletion({
                taskId: task.id,
                action: "finish",
              });
              await refresh();
            }}
          >
            Finish locally
          </button>
        )}
        <OverflowMenu label={`More actions for ${task.title}`}>
          {scope === "archived" && (
            <button onClick={() => void onAction(task.id, "restore")}>
              Restore
            </button>
          )}
          {scope === "active" && (
            <button
              disabled={["in_progress", "sync_pending"].includes(task.status)}
              title={
                ["in_progress", "sync_pending"].includes(task.status)
                  ? "Pause or finish active work before archiving"
                  : "Move this task to the archive"
              }
              onClick={() => void onAction(task.id, "archive")}
            >
              Archive
            </button>
          )}
          <button
            className="danger"
            disabled={["in_progress", "sync_pending"].includes(task.status)}
            title={
              ["in_progress", "sync_pending"].includes(task.status)
                ? "Pause or finish active work before deleting"
                : "Remove this task from AwenesOS"
            }
            onClick={async () => {
              if (
                await confirm(
                  "Remove this task from AwenesOS? Its audit tombstone will be retained.",
                  "Delete",
                )
              )
                void onAction(task.id, "delete");
            }}
          >
            Delete
          </button>
        </OverflowMenu>
      </div>
    </div>
  );
}
