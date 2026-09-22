import type { DesktopSnapshot } from "../../../contracts";
import { Empty, Pagination, Panel } from "./ui";
import { usePagination } from "../hooks/use-pagination";
import { pretty, taskName } from "../utils/presentation";

export function Approvals({
  data,
  refresh,
  reviewTask,
  confirm,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTask: (taskId: string) => void;
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}) {
  const approvalPage = usePagination(data.approvals);
  return (
    <section className="stack">
      <Panel title="Approval Inbox">
        {data.approvals.length ? (
          approvalPage.items.map((item) => {
            const taskId =
              data.runs.find((run) => run.id === item.runId)?.taskId ?? "";
            return (
            <div className="approval-card" key={item.id}>
              <div className="grow">
                <strong>{pretty(item.kind)} approval</strong>
                <p>{item.detail}</p>
                {item.planContent && (
                  <div className="plan-preview">
                    <small>Plan version {item.planVersion}</small>
                    <pre>{item.planContent}</pre>
                  </div>
                )}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => reviewTask(taskId)}
                >
                  {taskName(data, taskId)}
                </button>
              </div>
              <button
                className="ghost"
                onClick={async () => {
                  if (
                    item.kind !== "plan" &&
                    !(await confirm(
                      "This cancels the entire workflow run, not just this step. Completed work stays in the task's worktree, but the run itself cannot be resumed. Cancel this run?",
                      "Cancel run",
                    ))
                  )
                    return;
                  await window.awenes.decideApproval({
                    approvalId: item.id,
                    approved: false,
                  });
                  await refresh();
                }}
              >
                {item.kind === "plan" ? "Request changes" : "Cancel run"}
              </button>
              <button
                className="primary"
                onClick={async () => {
                  await window.awenes.decideApproval({
                    approvalId: item.id,
                    approved: true,
                  });
                  await refresh();
                }}
              >
                Approve
              </button>
            </div>
            );
          })
        ) : (
          <Empty
            title="Nothing Needs Approval"
            copy="Awenes pauses before sensitive delivery actions."
          />
        )}
        <Pagination {...approvalPage} label="approvals" />
      </Panel>
    </section>
  );
}
