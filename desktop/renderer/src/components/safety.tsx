import { useEffect, useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import type { ExecutionPolicy, ReadinessReport } from "../../../../src/domain/project";
import { BrowserTestSetup } from "./browser-test-setup";
import { Badge, Empty, Panel } from "./ui";
import { pretty, splitCommaSeparated } from "../utils/presentation";

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
          title="Select a project"
          copy="Review its effective permissions and environment readiness."
        />
      ) : (
        policy && (
          <>
            <div className="grid-two">
              <Panel title="Execution permissions">
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
                <button className="primary" onClick={() => void save()}>
                  {saved ? "Saved" : "Save policy"}
                </button>
              </Panel>
              <Panel title="Project setup">
                {readiness ? (
                  <>
                    <p>{readiness.ready ? "This project is ready for agent runs." : "This project needs attention before agent runs can start."}</p>
                    {readiness.checks.map((check) => <div className="row" key={check.name}>
                      <div><strong>{pretty(check.name)}</strong><small>{check.ready ? "Ready" : check.required ? "Action needed" : "Optional"}</small></div>
                      <Badge text={check.ready ? "Ready" : "Check"} />
                      {!check.ready && <details><summary>What to check</summary><p>{check.detail}</p></details>}
                    </div>)}
                  </>
                ) : (
                  <Empty
                    title="Not checked yet"
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
