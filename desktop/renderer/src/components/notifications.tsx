import type { DesktopSnapshot } from "../../../contracts";
import { Empty, Pagination, Panel } from "./ui";
import { usePagination } from "../hooks/use-pagination";

export function Notifications({
  data,
  refresh,
  reviewTask,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTask: (taskId: string) => void;
}) {
  const notificationPage = usePagination(data.notifications);
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
              {["workflow_completed", "completion_ready"].includes(item.kind) && (
                <button className="primary" onClick={() => reviewTask(item.taskId)}>
                  Review task →
                </button>
              )}
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
