import type { DesktopSnapshot } from "../../../contracts";
import { Empty, Pagination, Panel } from "./ui";
import { usePagination } from "../hooks/use-pagination";
import { pretty, taskName } from "../utils/presentation";

export function Approvals({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const approvalPage = usePagination(data.approvals);
  return (
    <section className="stack">
      <Panel title="Approval inbox">
        {data.approvals.length ? (
          approvalPage.items.map((item) => (
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
                <small>
                  {taskName(
                    data,
                    data.runs.find((run) => run.id === item.runId)?.taskId ??
                      "",
                  )}
                </small>
              </div>
              <button
                className="ghost"
                onClick={async () => {
                  await window.awenes.decideApproval({
                    approvalId: item.id,
                    approved: false,
                  });
                  await refresh();
                }}
              >
                {item.kind === "plan" ? "Request changes" : "Reject"}
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
          ))
        ) : (
          <Empty
            title="Nothing needs approval"
            copy="Awenes pauses before sensitive delivery actions."
          />
        )}
        <Pagination {...approvalPage} label="approvals" />
      </Panel>
    </section>
  );
}
