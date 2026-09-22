import type { DesktopSnapshot } from "../../../contracts";
import type { View } from "../utils/presentation";
import { Empty, Pagination, Panel } from "./ui";
import { usePagination } from "../hooks/use-pagination";

export function Notifications({
  data,
  refresh,
  reviewTask,
  reviewRun,
  navigate,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTask: (taskId: string) => void;
  reviewRun: (runId: string) => void;
  navigate: (view: View) => void;
}) {
  const notificationPage = usePagination(data.notifications);
  function action(item: DesktopSnapshot["notifications"][number]) {
    if (["workflow_completed", "completion_ready", "task_paused", "evidence_missing"].includes(item.kind)) {
      reviewTask(item.taskId);
      return;
    }
    if (item.kind === "workflow_approval_pending") {
      navigate("approvals");
      return;
    }
    if (item.kind === "workflow_failed") {
      const run =
        data.runs.find((value) => value.taskId === item.taskId) ??
        data.archivedRuns.find((value) => value.taskId === item.taskId);
      if (run) reviewRun(run.id);
      else navigate("runs");
      return;
    }
    navigate("tasks");
  }
  function actionLabel(kind: DesktopSnapshot["notifications"][number]["kind"]) {
    if (kind === "workflow_approval_pending") return "Open approval";
    if (kind === "workflow_failed") return "Open run";
    return "Review task";
  }
  return (
    <section className="stack">
      <Panel title="Notification Centre">
        {data.notifications.length ? (
          notificationPage.items.map((item) => (
            <div className="approval-card" key={item.key}>
              <div className="grow">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <small>{item.suggestedAction}</small>
              </div>
              <button className="primary" onClick={() => action(item)}>
                {actionLabel(item.kind)} →
              </button>
              <button
                className="ghost"
                onClick={async () => {
                  await window.awenes.notificationAction({
                    key: item.key,
                    action: "snooze",
                  });
                  await refresh();
                }}
              >
                Snooze 1h
              </button>
              <button
                className="small-button"
                onClick={async () => {
                  await window.awenes.notificationAction({
                    key: item.key,
                    action: "dismiss",
                  });
                  await refresh();
                }}
              >
                Dismiss
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="You're Caught Up"
            copy="Only actionable local reminders appear here."
          />
        )}
        <Pagination {...notificationPage} label="notifications" />
      </Panel>
    </section>
  );
}
