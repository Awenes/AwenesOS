import { useEffect, useState, type FormEvent } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { Badge, Empty, Pagination, Panel } from "./ui";
import { TaskReview } from "./task-review";
import { usePagination } from "../hooks/use-pagination";
import { pretty, projectName, splitLines } from "../utils/presentation";

export function Tasks({
  data,
  refresh,
  reviewTarget,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTarget: { id: string; request: number } | null;
}) {
  const [project, setProject] = useState("all");
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [show, setShow] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [completionDraft, setCompletionDraft] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const sourceTasks = scope === "active" ? data.tasks : data.archivedTasks;
  const filtered =
    project === "all"
      ? sourceTasks
      : sourceTasks.filter((task) => task.projectId === project);
  const taskPage = usePagination(filtered, `${scope}:${project}`);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await window.awenes.captureTask({
      title: String(form.get("title")),
      source: String(form.get("source")) as "manual",
      description: String(form.get("description")),
      acceptanceCriteria: splitLines(String(form.get("criteria"))),
      projectId: String(form.get("project")) || null,
    });
    setShow(false);
    await refresh();
  }
  async function act(
    taskId: string,
    action:
      "claim" | "start" | "pause" | "resume" | "archive" | "restore" | "delete",
  ) {
    await window.awenes.taskAction({ taskId, action });
    await refresh();
  }
  async function openTask(taskId: string) {
    const summary = await window.awenes.taskSummary(taskId);
    const run = data.runs.find((item) => item.taskId === taskId);
    const task = (summary as { task: { status: string; completionDescription: string | null } }).task;
    setCompletionDraft(
      task.status === "ready_to_complete"
        ? task.completionDescription ?? ""
        : ["in_progress", "paused"].includes(task.status)
          ? await window.awenes.taskCompletionDraft(taskId)
          : "",
    );
    setDetails({
      ...(summary as Record<string, unknown>),
      workflow: run ? await window.awenes.runDetails(run.id) : null,
    });
    window.requestAnimationFrame(() =>
      document.getElementById("task-review")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  useEffect(() => {
    if (!reviewTarget) return;
    setProject("all");
    setScope("active");
    void openTask(reviewTarget.id);
  }, [reviewTarget]);
  async function saveReview() {
    if (!details || !completionDraft.trim()) return;
    setReviewBusy(true);
    try {
      await window.awenes.taskCompletion({
        taskId: details.task.id,
        action: details.task.status === "ready_to_complete" ? "edit" : "prepare",
        description: completionDraft.trim(),
      });
      await refresh();
      await openTask(details.task.id);
    } finally {
      setReviewBusy(false);
    }
  }
  async function finishReview() {
    if (!details || !window.confirm("Mark this task complete locally? Review the evidence and summary first.")) return;
    setReviewBusy(true);
    try {
      await window.awenes.taskCompletion({ taskId: details.task.id, action: "finish" });
      await refresh();
      await openTask(details.task.id);
    } finally {
      setReviewBusy(false);
    }
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
        <form className="form-card" onSubmit={(event) => void submit(event)}>
          <label>
            Task title
            <input
              name="title"
              required
              placeholder="Fix checkout validation"
            />
          </label>
          <label>
            Project
            <select name="project" required defaultValue="">
              <option value="" disabled>
                Choose project
              </option>
              {data.projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="source" value="manual" />
          <label>
            Description
            <textarea
              name="description"
              rows={3}
              placeholder="What needs to be done?"
            />
          </label>
          <label>
            Done means{" "}
            <span className="optional">optional · one check per line</span>
            <textarea
              name="criteria"
              rows={3}
              placeholder={"Tests pass\nValidation errors are clear"}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
            <button className="primary">Start task</button>
          </div>
        </form>
      )}
      <Panel title={`${filtered.length} tasks`}>
        {filtered.length ? (
          taskPage.items.map((task) => (
            <div className="task-row" key={task.id}>
              <div className="task-status" data-status={task.status} />
              <div className="grow">
                <strong>{task.title}</strong>
                <small>
                  {projectName(data, task.projectId)} · {pretty(task.source)}
                </small>
              </div>
              <Badge
                text={
                  data.runs.some((run) => run.taskId === task.id && run.status === "completed") &&
                  ["in_progress", "paused"].includes(task.status)
                    ? "Ready for review"
                    : pretty(task.status)
                }
              />
              {scope === "archived" && (
                <button
                  className="small-button"
                  onClick={() => void act(task.id, "restore")}
                >
                  Restore
                </button>
              )}
              <button
                className="small-button"
                onClick={() => void openTask(task.id)}
              >
                Details
              </button>
              {data.runs.some((run) => run.taskId === task.id && run.status === "completed") &&
                ["in_progress", "paused", "ready_to_complete"].includes(task.status) && (
                  <button className="primary" onClick={() => void openTask(task.id)}>
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
                  onClick={() => void act(task.id, "claim")}
                >
                  Claim
                </button>
              )}
              {task.status === "planned" && (
                <button
                  className="small-button"
                  onClick={() => void act(task.id, "start")}
                >
                  Start
                </button>
              )}
              {task.status === "in_progress" && (
                <button
                  className="small-button"
                  onClick={() => void act(task.id, "pause")}
                >
                  Pause
                </button>
              )}
              {task.status === "paused" && (
                <button
                  className="small-button"
                  onClick={() => void act(task.id, "resume")}
                >
                  Resume
                </button>
              )}
              {["in_progress", "paused"].includes(task.status) &&
                !data.runs.some((run) => run.taskId === task.id && run.status === "completed") && (
                <button
                  className="small-button"
                  onClick={async () => {
                    const description =
                      window.prompt(
                        "Completion description (leave blank to draft from evidence)",
                      ) ?? undefined;
                    await window.awenes.taskCompletion({
                      taskId: task.id,
                      action: "prepare",
                      description,
                    });
                    await refresh();
                  }}
                >
                  Prepare completion
                </button>
              )}
              {task.status === "ready_to_complete" &&
                !data.runs.some((run) => run.taskId === task.id && run.status === "completed") && (
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
              {scope === "active" && (
                <button
                  className="small-button"
                  disabled={["in_progress", "sync_pending"].includes(
                    task.status,
                  )}
                  title={
                    ["in_progress", "sync_pending"].includes(task.status)
                      ? "Pause or finish active work before archiving"
                      : "Move this task to the archive"
                  }
                  onClick={() => void act(task.id, "archive")}
                >
                  Archive
                </button>
              )}
              <button
                className="small-button danger"
                disabled={["in_progress", "sync_pending"].includes(task.status)}
                title={
                  ["in_progress", "sync_pending"].includes(task.status)
                    ? "Pause or finish active work before deleting"
                    : "Remove this task from AwenesOS"
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this task from AwenesOS? Its audit tombstone will be retained.",
                    )
                  )
                    void act(task.id, "delete");
                }}
              >
                Delete
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="No matching tasks"
            copy="Capture work here or from the CLI."
          />
        )}
        <Pagination {...taskPage} label="tasks" />
      </Panel>
      {details && (
        <TaskReview
          details={details}
          completionDraft={completionDraft}
          setCompletionDraft={setCompletionDraft}
          reviewBusy={reviewBusy}
          saveReview={saveReview}
          finishReview={finishReview}
          close={() => setDetails(null)}
        />
      )}
    </section>
  );
}
