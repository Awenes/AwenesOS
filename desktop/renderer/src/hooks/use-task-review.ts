import { useEffect, useRef, useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";

/**
 * Owns the task-review panel's state and its three async actions (open,
 * save, finish). Guards against stale responses when the user opens a
 * different task before a slower `openTask` call resolves.
 */
export function useTaskReview(
  data: DesktopSnapshot,
  refresh: () => Promise<void>,
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>,
  reviewTarget: { id: string; request: number } | null,
  onReviewTargetOpened?: () => void,
) {
  const [details, setDetails] = useState<any>(null);
  const [completionDraft, setCompletionDraft] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const openRequest = useRef(0);

  async function openTask(taskId: string) {
    const request = ++openRequest.current;
    const summary = await window.awenes.taskSummary(taskId);
    const run = data.runs.find((item) => item.taskId === taskId);
    const task = (
      summary as {
        task: { status: string; completionDescription: string | null };
      }
    ).task;
    const draft =
      task.status === "ready_to_complete"
        ? (task.completionDescription ?? "")
        : ["in_progress", "paused"].includes(task.status)
          ? await window.awenes.taskCompletionDraft(taskId)
          : "";
    const workflow = run ? await window.awenes.runDetails(run.id) : null;
    if (request !== openRequest.current) return;
    setCompletionDraft(draft);
    setDetails({
      ...(summary as Record<string, unknown>),
      workflow,
    });
    window.requestAnimationFrame(() =>
      document
        .getElementById("task-review")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  useEffect(() => {
    if (!reviewTarget) return;
    onReviewTargetOpened?.();
    void openTask(reviewTarget.id);
    // openTask intentionally excluded: it closes over `data`/`onReviewTargetOpened`,
    // which change every refresh, and re-running this effect should be driven
    // only by a new reviewTarget request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (
      !details ||
      !(await confirm(
        "Mark this task complete locally? Review the evidence and summary first.",
        "Finish locally",
      ))
    )
      return;
    setReviewBusy(true);
    try {
      await window.awenes.taskCompletion({ taskId: details.task.id, action: "finish" });
      await refresh();
      await openTask(details.task.id);
    } finally {
      setReviewBusy(false);
    }
  }

  return {
    details,
    completionDraft,
    setCompletionDraft,
    reviewBusy,
    openTask,
    saveReview,
    finishReview,
    closeReview: () => setDetails(null),
  };
}
