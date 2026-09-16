import { useEffect, useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import type { ExecutionPolicy, ReadinessReport } from "../../../../src/domain/project";
import { BrowserTestSetup } from "./browser-test-setup";
import { Empty, Panel } from "./ui";
import { StatusIcon } from "./status-icon";
import { pretty, readinessGuidance, splitCommaSeparated } from "../utils/presentation";

export function Safety({ data }: { data: DesktopSnapshot }) {
  const [selected, setSelected] = useState(data.projects[0]?.id ?? "");
  const [policy, setPolicy] = useState<ExecutionPolicy | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!selected) {
      setPolicy(null);
      return;
    }
    void window.awenes.executionPolicy(selected).then(setPolicy);
    setReadiness(null);
  }, [selected]);
  async function save() {
    if (!policy) return;
    await window.awenes.saveExecutionPolicy({ projectId: selected, policy });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <section className="stack">
      <div className="section-bar">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select project</option>
          {data.projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selected && (
          <button
            className="ghost"
            onClick={async () =>
              setReadiness(await window.awenes.projectReadiness(selected) as ReadinessReport)
            }
          >
            Check project setup
          </button>
        )}
      </div>
      {!selected ? (
        <Empty
          title="Select a Project"
          copy="Review its effective permissions and environment readiness."
        />
      ) : (
        policy && (
          <>
            <div className="grid-two">
              <Panel title="Execution Permissions">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={policy.autoGrantAgentAccess}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        autoGrantAgentAccess: e.target.checked,
                      })
                    }
                  />
                  Automatically grant access required by agent runs
                </label>
                <small>
                  Allows provider network access and the connected provider
                  command before a run. Git push approval remains separate.
                </small>
                <label>
                  Network access
                  <select
                    value={policy.networkAccess}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        networkAccess: e.target
                          .value as ExecutionPolicy["networkAccess"],
                      })
                    }
                  >
                    <option value="none">Disabled</option>
                    <option value="localhost">Localhost only</option>
                    <option value="public">Public network</option>
                  </select>
                </label>
                <label>
                  Process timeout (seconds)
                  <input
                    type="number"
                    value={policy.processTimeoutSeconds}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        processTimeoutSeconds: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Allowed commands
                  <input
                    value={policy.commandAllowlist.join(", ")}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        commandAllowlist: splitCommaSeparated(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Allowed environment variables
                  <input
                    value={policy.environmentAllowlist.join(", ")}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        environmentAllowlist: splitCommaSeparated(
                          e.target.value,
                        ),
                      })
                    }
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={policy.requirePushApproval}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        requirePushApproval: e.target.checked,
                      })
                    }
                  />
                  Require developer approval before Git push
                </label>
                <button className="primary save-policy" onClick={() => void save()}>
                  {saved ? "Saved" : "Save Policy"}
                </button>
              </Panel>
              <Panel title="Project Setup">
                {readiness ? (
                  <>
                    <p>{readiness.ready ? "This project is ready for agent runs." : "This project needs attention before agent runs can start."}</p>
                    {readiness.checks.map((check) => {
                      const state = check.ready ? "ready" : check.required ? "attention" : "optional";
                      return (
                        <div className="readiness-row" data-state={state} key={check.name}>
                          <div className="readiness-row-head">
                            <StatusIcon state={state} />
                            <div>
                              <strong>{pretty(check.name)}</strong>
                              <small>{check.ready ? "Ready" : check.required ? "Action needed" : "Optional"}</small>
                            </div>
                          </div>
                          {!check.ready && (
                            <div className="readiness-row-detail">
                              <p>{readinessGuidance(check.name)}</p>
                              <details>
                                <summary>Technical details</summary>
                                <p>{check.detail}</p>
                              </details>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <Empty
                    title="Not Checked Yet"
                    copy="Run the read-only check to verify Git, Node, pnpm, repository access, and worktree support."
                  />
                )}
              </Panel>
            </div>
            <BrowserTestSetup projectId={selected} />
          </>
        )
      )}
    </section>
  );
}
