import { useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { Empty, Pagination, Panel } from "./ui";
import { TaskCaptureForm } from "./task-capture-form";
import { TaskRow } from "./task-row";
import { TaskReview } from "./task-review";
import { usePagination } from "../hooks/use-pagination";
import { useTaskReview } from "../hooks/use-task-review";

export function Tasks({
  data,
  refresh,
  reviewTarget,
  confirm,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTarget: { id: string; request: number } | null;
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}) {
  const [project, setProject] = useState("all");
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [show, setShow] = useState(false);
  const sourceTasks = scope === "active" ? data.tasks : data.archivedTasks;
  const filtered =
    project === "all"
      ? sourceTasks
      : sourceTasks.filter((task) => task.projectId === project);
  const taskPage = usePagination(filtered, `${scope}:${project}`);
  const review = useTaskReview(data, refresh, confirm, reviewTarget, () => {
    setProject("all");
    setScope("active");
  });
  async function act(
    taskId: string,
    action:
      | "confirm"
      | "claim"
      | "reject"
      | "start"
      | "pause"
      | "resume"
      | "archive"
      | "restore"
      | "delete",
  ) {
    await window.awenes.taskAction({ taskId, action });
    await refresh();
  }
  return (
    <section className="stack">
      <div className="section-bar">
        <div className="segmented" aria-label="Task list">
          <button
            className={scope === "active" ? "selected" : ""}
            onClick={() => setScope("active")}
          >
            Active
          </button>
          <button
            className={scope === "archived" ? "selected" : ""}
            onClick={() => setScope("archived")}
          >
            Archived ({data.archivedTasks.length})
          </button>
        </div>
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="all">All projects</option>
          {data.projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => setShow(!show)}>
          + Capture task
        </button>
      </div>
      {show && (
        <TaskCaptureForm
          projects={data.projects}
          onCancel={() => setShow(false)}
          onCaptured={async () => {
            setShow(false);
            await refresh();
          }}
        />
      )}
      <Panel title={`${filtered.length} Tasks`}>
        {filtered.length ? (
          taskPage.items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              data={data}
              scope={scope}
              onOpen={(taskId) => void review.openTask(taskId)}
              onAction={act}
              refresh={refresh}
              confirm={confirm}
            />
          ))
        ) : (
          <Empty
            title="No Matching Tasks"
            copy="Capture work here or from the CLI."
          />
        )}
        <Pagination {...taskPage} label="tasks" />
      </Panel>
      {review.details && (
        <TaskReview
          details={review.details}
          completionDraft={review.completionDraft}
          setCompletionDraft={review.setCompletionDraft}
          reviewBusy={review.reviewBusy}
          saveReview={review.saveReview}
          finishReview={review.finishReview}
          close={review.closeReview}
        />
      )}
    </section>
  );
}
