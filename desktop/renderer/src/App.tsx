import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DesktopSnapshot } from "../../contracts";
import type { ExecutionPolicy } from "../../../src/domain/project";
import {
  PROVIDER_MODELS,
  providerModelName,
} from "../../../src/domain/provider-model";

type View =
  | "overview"
  | "projects"
  | "tasks"
  | "runs"
  | "approvals"
  | "agents"
  | "providers"
  | "notifications"
  | "safety";
const empty: DesktopSnapshot = {
  projects: [],
  tasks: [],
  roles: [],
  providers: [],
  runs: [],
  approvals: [],
  notifications: [],
  pendingCrm: 0,
  pendingTracker: 0,
};
export function App() {
  const [snapshot, setSnapshot] = useState(empty);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [error, setError] = useState("");
  const refresh = async () => {
    setLoading(true);
    try {
      setSnapshot(await window.awenes.snapshot());
      setError("");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => window.awenes.onActivity(setPendingOperations), []);
  useEffect(() => {
    void refresh();
  }, []);
  const workflowActive = snapshot.runs.some(
    (run) => run.status === "running" && run.stepStatus === "running",
  );
  useEffect(() => {
    if (!workflowActive) return;
    const timer = window.setInterval(async () => {
      try {
        setSnapshot(await window.awenes.snapshot());
      } catch (cause) {
        setError(message(cause));
      }
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [workflowActive]);
  useEffect(() => {
    const rejected = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      setError(message(event.reason));
    };
    window.addEventListener("unhandledrejection", rejected);
    return () => window.removeEventListener("unhandledrejection", rejected);
  }, []);
  const active = snapshot.tasks.filter((task) =>
    [
      "planned",
      "in_progress",
      "paused",
      "ready_to_complete",
      "sync_pending",
    ].includes(task.status),
  );
  return (
    <div className="shell" aria-busy={loading || pendingOperations > 0}>
      {(loading || pendingOperations > 0) && (
        <div className="activity" role="status" aria-live="polite">
          <span className="spinner" />
          Working…
        </div>
      )}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <strong>AwenesOS</strong>
            <small>Developer command center</small>
          </div>
        </div>
        <nav>
          {(
            [
              ["overview", "Overview"],
              ["projects", "Projects"],
              ["tasks", "Tasks"],
              ["runs", "Runs"],
              ["approvals", "Approvals"],
              ["agents", "Agents"],
              ["providers", "Providers"],
              ["notifications", "Notifications"],
              ["safety", "Safety"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <span>{icon(id)}</span>
              {label}
              {id === "approvals" && snapshot.approvals.length > 0 ? (
                <em>{snapshot.approvals.length}</em>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" />
          Local engine online
          <small>{snapshot.projects.length} projects connected</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">LOCAL-FIRST WORKSPACE</p>
            <h1>{title(view)}</h1>
          </div>
          <button
            className="ghost"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>
        {error && (
          <div className="error">
            <strong>Something needs attention</strong>
            <span>{error}</span>
          </div>
        )}
        {view === "overview" && (
          <Overview data={snapshot} active={active} navigate={setView} />
        )}
        {view === "projects" && <Projects data={snapshot} refresh={refresh} />}
        {view === "tasks" && <Tasks data={snapshot} refresh={refresh} />}
        {view === "runs" && <Runs data={snapshot} refresh={refresh} />}
        {view === "approvals" && (
          <Approvals data={snapshot} refresh={refresh} />
        )}
        {view === "agents" && <Agents data={snapshot} refresh={refresh} />}
        {view === "providers" && (
          <Providers data={snapshot} refresh={refresh} />
        )}
        {view === "notifications" && (
          <Notifications data={snapshot} refresh={refresh} />
        )}
        {view === "safety" && <Safety data={snapshot} />}
      </main>
    </div>
  );
}

function Providers({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [kind, setKind] = useState<"openai" | "anthropic">("openai");
  const [authMethod, setAuthMethod] = useState<"api_key" | "cli">("api_key");
  const [models, setModels] = useState<string[]>([
    PROVIDER_MODELS.openai[0].id,
  ]);
  const [verifyingProvider, setVerifyingProvider] = useState<string | null>(
    null,
  );
  useEffect(() => setModels([PROVIDER_MODELS[kind][0].id]), [kind]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await window.awenes.connectProvider({
      name: String(form.get("name")),
      kind,
      authMethod,
      command: authMethod === "cli" ? String(form.get("command")) : null,
      models,
      apiKey: authMethod === "api_key" ? String(form.get("key")) : undefined,
    });
    setShow(false);
    await refresh();
  }
  return (
    <section className="stack">
      <div className="section-bar">
        <p>
          Connect models with an API key or an already authenticated local
          coding CLI.
        </p>
        <button className="primary" onClick={() => setShow(!show)}>
          + Connect provider
        </button>
      </div>
      {show && (
        <form className="form-card" onSubmit={(e) => void submit(e)}>
          <label>
            Connection name
            <input name="name" required placeholder="My OpenAI account" />
          </label>
          <div className="form-grid">
            <label>
              Provider
              <select
                name="kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as "openai" | "anthropic")
                }
              >
                <option value="openai">OpenAI / Codex</option>
                <option value="anthropic">Anthropic / Claude</option>
              </select>
            </label>
            <label>
              Authentication
              <select
                name="auth"
                value={authMethod}
                onChange={(event) =>
                  setAuthMethod(event.target.value as "api_key" | "cli")
                }
              >
                <option value="api_key">API key</option>
                <option value="cli">Use an existing provider sign-in</option>
              </select>
            </label>
          </div>
          {authMethod === "api_key" ? (
            <label>
              API key
              <input name="key" type="password" autoComplete="off" required />
            </label>
          ) : (
            <>
              <p className="field-help">
                Use this option only if you already use {kind === "openai" ? "Codex" : "Claude"}
                {" "}from a terminal on this computer. AwenesOS will reuse that
                sign-in; it will not open a new login window.
              </p>
              <details className="advanced">
                <summary>Advanced: CLI location</summary>
                <label>
                  Program location
                  <input
                    key={kind}
                    name="command"
                    required
                    defaultValue={kind === "openai" ? "codex" : "claude"}
                    placeholder="Command name or full executable path"
                  />
                </label>
                <small>
                  Keep the default unless AwenesOS says it cannot find the
                  provider program. In that case, browse Windows for the
                  executable and paste its complete location here.
                </small>
              </details>
            </>
          )}
          <fieldset className="model-picker">
            <legend>Models available to agents</legend>
            {PROVIDER_MODELS[kind].map((model) => (
              <label key={model.id} className="check">
                <input
                  type="checkbox"
                  checked={models.includes(model.id)}
                  onChange={(event) =>
                    setModels((current) =>
                      event.target.checked
                        ? [...current, model.id]
                        : current.filter((id) => id !== model.id),
                    )
                  }
                />
                {model.name}
              </label>
            ))}
            {!models.length && <small>Choose at least one model.</small>}
          </fieldset>
          <div className="form-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
            <button className="primary" disabled={!models.length}>
              Connect and verify
            </button>
          </div>
        </form>
      )}
      <div className="cards">
        {data.providers.map((provider) => (
          <article className="project-card" key={provider.id}>
            <div className="project-icon">
              {provider.kind === "openai" ? "O" : "C"}
            </div>
            <div className="grow">
              <h3>{provider.name}</h3>
              <p>
                {pretty(provider.authMethod)} ·{" "}
                {provider.error ??
                  (provider.status === "ready"
                    ? provider.lastCheckedAt
                      ? `Verified ${formatCheckedAt(provider.lastCheckedAt)}`
                      : "Connection verified"
                    : "Waiting for verification")}
              </p>
              <div className="tags">
                <Badge text={pretty(provider.kind)} />
                <Badge text={pretty(provider.status)} />
              </div>
            </div>
            {provider.status !== "ready" && (
              <button
                className="small-button"
                disabled={verifyingProvider === provider.id}
                onClick={async () => {
                  setVerifyingProvider(provider.id);
                  try {
                    await window.awenes.verifyProvider(provider.id);
                    await refresh();
                  } finally {
                    setVerifyingProvider(null);
                  }
                }}
              >
                {verifyingProvider === provider.id ? "Verifying…" : "Verify"}
              </button>
            )}
            <button
              className="small-button"
              onClick={async () => {
                await window.awenes.disconnectProvider(provider.id);
                await refresh();
              }}
            >
              Disconnect
            </button>
          </article>
        ))}
        {!data.providers.length && (
          <Empty
            title="No model provider connected"
            copy="API keys are encrypted locally. CLI mode uses the provider tool's own supported login."
          />
        )}
      </div>
    </section>
  );
}

function Overview({
  data,
  active,
  navigate,
}: {
  data: DesktopSnapshot;
  active: DesktopSnapshot["tasks"];
  navigate: (view: View) => void;
}) {
  return (
    <section className="stack">
      <Onboarding data={data} navigate={navigate} />
      <div className="metrics">
        <Metric
          label="Projects"
          value={data.projects.length}
          note="Local repositories"
          tone="blue"
        />
        <Metric
          label="Active work"
          value={active.length}
          note="Across all projects"
          tone="violet"
        />
        <Metric
          label="CRM updates"
          value={data.pendingCrm}
          note="Awaiting confirmation"
          tone="amber"
        />
        <Metric
          label="Tracker updates"
          value={data.pendingTracker}
          note="Manual SharePoint steps"
          tone="green"
        />
      </div>
      <div className="grid-two">
        <Panel
          title="Current work"
          action="Open tasks"
          onAction={() => navigate("tasks")}
        >
          {active.length ? (
            active.slice(0, 5).map((task) => (
              <div className="row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>{projectName(data, task.projectId)}</small>
                </div>
                <Badge text={pretty(task.status)} />
              </div>
            ))
          ) : (
            <Empty
              title="No active work"
              copy="Claim a captured task when you're ready to begin."
            />
          )}
        </Panel>
        <Panel
          title="Project health"
          action="Review safety"
          onAction={() => navigate("safety")}
        >
          {data.projects.length ? (
            data.projects.map((project) => (
              <div className="row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <small>
                    {project.defaultBranch} · {pretty(project.completionPolicy)}
                  </small>
                </div>
                <span className="healthy">Ready to inspect</span>
              </div>
            ))
          ) : (
            <Empty
              title="No projects registered"
              copy="Add your first local repository to begin."
            />
          )}
        </Panel>
      </div>
      <Panel title="How Awenes protects your work">
        <div className="guardrails">
          <Guard
            title="Dedicated worktrees"
            copy="Agents never write in your normal checkout."
          />
          <Guard
            title="Approval-aware delivery"
            copy="Push behavior follows each project's policy."
          />
          <Guard
            title="Evidence before completion"
            copy="Tasks stay open until external confirmation."
          />
        </div>
      </Panel>
    </section>
  );
}

function Onboarding({
  data,
  navigate,
}: {
  data: DesktopSnapshot;
  navigate: (view: View) => void;
}) {
  const checks = [
    {
      label: "Register a project",
      done: data.projects.length > 0,
      view: "projects" as View,
    },
    {
      label: "Connect a model provider",
      done: data.providers.some((item) => item.status === "ready"),
      view: "providers" as View,
    },
    {
      label: "Assign models to enabled roles",
      done: data.roles
        .filter((role) => role.enabled)
        .every((role) => Boolean(role.providerId && role.modelId)),
      view: "agents" as View,
    },
    {
      label: "Review project safety",
      done: data.projects.length > 0,
      view: "safety" as View,
    },
  ];
  if (checks.every((item) => item.done)) return null;
  return (
    <Panel title="Finish setup">
      <div className="onboarding">
        {checks.map((item) => (
          <button
            key={item.label}
            className={item.done ? "done" : ""}
            onClick={() => navigate(item.view)}
          >
            <span>{item.done ? "✓" : "○"}</span>
            {item.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Projects({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [repositoryRoot, setRepositoryRoot] = useState("");
  const [choosingFolder, setChoosingFolder] = useState(false);
  async function chooseFolder() {
    setChoosingFolder(true);
    try {
      const selected = await window.awenes.selectProjectDirectory();
      if (selected) setRepositoryRoot(selected);
    } finally {
      setChoosingFolder(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await window.awenes.addProject({
      name: String(form.get("name")),
      repositoryRoot: String(form.get("path")),
      defaultBranch: String(form.get("branch")),
      completionPolicy: String(form.get("policy")) as
        "manual" | "approve_push" | "auto_push",
    });
    setShow(false);
    await refresh();
  }
  return (
    <section className="stack">
      <div className="section-bar">
        <p>Connect and manage every local codebase from one place.</p>
        <button className="primary" onClick={() => setShow(!show)}>
          + Add project
        </button>
      </div>
      {show && (
        <form className="form-card" onSubmit={(event) => void submit(event)}>
          <label>
            Project name
            <input name="name" required placeholder="Customer portal" />
          </label>
          <label>
            Repository path
            <div className="input-action">
              <input
                name="path"
                required
                readOnly
                value={repositoryRoot}
                placeholder="Choose a local Git repository"
              />
              <button
                type="button"
                className="small-button"
                onClick={() => void chooseFolder()}
              >
                {choosingFolder ? "Opening…" : "Browse…"}
              </button>
            </div>
          </label>
          <div className="form-grid">
            <label>
              Default branch
              <input name="branch" required defaultValue="main" />
            </label>
            <label>
              Completion policy
              <select name="policy" defaultValue="manual">
                <option value="manual">Preview manually</option>
                <option value="approve_push">Approve before push</option>
                <option value="auto_push">Automatic push</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setShow(false)}
            >
              Cancel
            </button>
            <button className="primary">Register project</button>
          </div>
        </form>
      )}
      <div className="cards">
        {data.projects.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="project-icon">
              {project.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="grow">
              <h3>{project.name}</h3>
              <p>{project.repositoryRoot}</p>
              <div className="tags">
                <Badge text={project.defaultBranch} />
                <Badge text={pretty(project.completionPolicy)} />
                <Badge
                  text={`${data.tasks.filter((t) => t.projectId === project.id).length} tasks`}
                />
              </div>
            </div>
          </article>
        ))}
        {!data.projects.length && (
          <Empty
            title="Your projects will appear here"
            copy="Register a local Git repository. Awenes only records it; no agent will run automatically."
          />
        )}
      </div>
    </section>
  );
}

function Tasks({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [project, setProject] = useState("all");
  const [show, setShow] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const filtered =
    project === "all"
      ? data.tasks
      : data.tasks.filter((task) => task.projectId === project);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await window.awenes.captureTask({
      title: String(form.get("title")),
      source: String(form.get("source")) as "manual",
      description: String(form.get("description")),
      projectId: String(form.get("project")) || null,
    });
    setShow(false);
    await refresh();
  }
  async function act(
    taskId: string,
    action: "claim" | "start" | "pause" | "resume",
  ) {
    await window.awenes.taskAction({ taskId, action });
    await refresh();
  }
  return (
    <section className="stack">
      <div className="section-bar">
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
              <option value="" disabled>Choose project</option>
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
          filtered.map((task) => (
            <div className="task-row" key={task.id}>
              <div className="task-status" data-status={task.status} />
              <div className="grow">
                <strong>{task.title}</strong>
                <small>
                  {projectName(data, task.projectId)} · {pretty(task.source)}
                </small>
              </div>
              <Badge text={pretty(task.status)} />
              <button
                className="small-button"
                onClick={async () =>
                  setDetails(await window.awenes.taskSummary(task.id))
                }
              >
                Details
              </button>
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
              {["in_progress", "paused"].includes(task.status) && (
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
              {task.status === "ready_to_complete" && (
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
              {task.status === "sync_pending" && (
                <button
                  className="primary"
                  onClick={async () => {
                    await window.awenes.taskCompletion({
                      taskId: task.id,
                      action: "confirm_crm",
                    });
                    await refresh();
                  }}
                >
                  I updated CRM
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="No matching tasks"
            copy="Capture work manually or import candidates through the CLI."
          />
        )}
      </Panel>
      {details && (
        <Panel title={`Task details · ${details.task.title}`}>
          <div className="summary-grid">
            <div>
              <small>Active work</small>
              <strong>{details.duration.active}</strong>
            </div>
            <div>
              <small>Paused</small>
              <strong>{details.duration.paused}</strong>
            </div>
            <div>
              <small>Total elapsed</small>
              <strong>{details.duration.calendar}</strong>
            </div>
            <div>
              <small>Evidence</small>
              <strong>{details.evidence.length}</strong>
            </div>
          </div>
          {details.task.assignmentDescription && (
            <p>{details.task.assignmentDescription}</p>
          )}
          {details.evidence.map((item: any) => (
            <div className="row" key={item.id}>
              <span>{pretty(item.kind)}</span>
              <small>{item.value}</small>
            </div>
          ))}
          {details.pendingCrmUpdate && (
            <div className="approval-card">
              <div className="grow">
                <strong>Manual CRM update required</strong>
                <p>
                  {details.pendingCrmUpdate.description ||
                    details.pendingCrmUpdate.desiredStatus}
                </p>
              </div>
            </div>
          )}
          {details.pendingTrackerUpdate && (
            <div className="approval-card">
              <div className="grow">
                <strong>Update the live SharePoint tracker</strong>
                <p>
                  Set this item to {details.pendingTrackerUpdate.desiredStatus},
                  then confirm here.
                </p>
              </div>
              <button
                className="primary"
                onClick={async () => {
                  await window.awenes.taskCompletion({
                    taskId: details.task.id,
                    action: "confirm_tracker",
                  });
                  setDetails(await window.awenes.taskSummary(details.task.id));
                  await refresh();
                }}
              >
                I updated tracker
              </button>
            </div>
          )}
          <button className="ghost" onClick={() => setDetails(null)}>
            Close details
          </button>
        </Panel>
      )}
    </section>
  );
}

function Runs({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [executingStage, setExecutingStage] = useState<string | null>(null);
  const [executionSeconds, setExecutionSeconds] = useState(0);
  useEffect(() => {
    if (!executingStage) return;
    setExecutionSeconds(0);
    const timer = window.setInterval(
      () => setExecutionSeconds((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [executingStage]);
  async function open(id: string) {
    setSelected(id);
    setDetails(await window.awenes.runDetails(id));
  }
  async function action(
    runId: string,
    action: "next" | "pause" | "resume" | "cancel",
  ) {
    setBusy(true);
    if (action === "next") setExecutingStage(details?.run.currentStage ?? "stage");
    try {
      await window.awenes.runAction({ runId, action });
      await refresh();
      await open(runId);
    } finally {
      setExecutingStage(null);
      setBusy(false);
    }
  }
  async function git(runId: string, action: "review" | "commit" | "push") {
    setBusy(true);
    try {
      if (action === "review")
        setDetails({
          ...details,
          delivery: await window.awenes.gitReview(runId),
        });
      else if (action === "commit")
        await window.awenes.gitCommit({
          runId,
          message: `feat: complete ${taskName(data, details?.run?.taskId)}`,
        });
      else await window.awenes.gitPush(runId);
      await refresh();
      await open(runId);
    } finally {
      setBusy(false);
    }
  }
  async function allowProviderAndResume(runId: string, projectId: string) {
    setBusy(true);
    try {
      const policy = await window.awenes.executionPolicy(projectId);
      const providerCommands = data.providers
        .filter((provider) => provider.status === "ready" && provider.command)
        .map((provider) => provider.command!);
      await window.awenes.saveExecutionPolicy({
        projectId,
        policy: {
          ...policy,
          networkAccess: "public",
          commandAllowlist: [
            ...new Set([...policy.commandAllowlist, ...providerCommands]),
          ],
          environmentAllowlist: [
            ...new Set([
              ...policy.environmentAllowlist,
              "PATH",
              "Path",
              "PATHEXT",
              "SystemRoot",
            ]),
          ],
        },
      });
      await window.awenes.runAction({ runId, action: "resume" });
      await refresh();
      await open(runId);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack">
      <div className="grid-two">
        <Panel title="Workflow runs">
          {data.runs.length ? (
            data.runs.map((run) => (
              <button
                className={`run-row ${selected === run.id ? "selected" : ""}`}
                key={run.id}
                onClick={() => void open(run.id)}
              >
                <span>
                  <strong>{taskName(data, run.taskId)}</strong>
                  <small>
                    {pretty(run.currentStage ?? "not started")} ·{" "}
                    {run.error ?? projectName(data, run.projectId)}
                  </small>
                </span>
                <Badge
                  text={
                    run.id === selected && executingStage
                      ? `Running ${pretty(executingStage)}`
                      : run.status === "running"
                        ? run.stepStatus === "running"
                          ? `Working: ${pretty(run.currentStage ?? "task")}`
                          : "Preparing"
                        : pretty(run.status)
                  }
                />
              </button>
            ))
          ) : (
            <Empty
              title="No workflow runs"
              copy="Open a task and create a run after configuring its roles and provider."
            />
          )}
        </Panel>
        <Panel title="Run inspector">
          {!details ? (
            <Empty
              title="Select a run"
              copy="Inspect snapshotted instructions, attempts, approvals, evidence, and delivery."
            />
          ) : (
            <>
              <div className="run-actions">
                {details.run.status === "failed" &&
                  /Network access denied|Command is not allowed/.test(
                    details.run.error ?? "",
                  ) && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void allowProviderAndResume(
                          details.run.id,
                          details.run.projectId,
                        )
                      }
                    >
                      Allow provider access and retry
                    </button>
                  )}
                <button
                  disabled={busy || details.run.status !== "running"}
                  onClick={() => void action(details.run.id, "next")}
                >
                  {executingStage
                    ? `Running ${pretty(executingStage)}… ${executionSeconds}s`
                    : `Run ${pretty(details.run.currentStage ?? "next")} stage`}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void action(details.run.id, "pause")}
                >
                  Pause
                </button>
                <button
                  disabled={busy}
                  onClick={() => void action(details.run.id, "resume")}
                >
                  Resume
                </button>
              </div>
              {details.steps.map((step: any) => (
                <div className="row" key={step.id}>
                  <div>
                    <strong>{pretty(step.stage)}</strong>
                    <small>
                      Attempt {step.attempt}
                      {step.output
                        ? ` · ${String(step.output).slice(0, 90)}`
                        : ""}
                    </small>
                  </div>
                  <Badge text={pretty(step.status)} />
                </div>
              ))}
              <div className="run-actions">
                <button
                  onClick={() =>
                    void window.awenes
                      .runBrowserTest(details.run.id)
                      .then(() => open(details.run.id))
                  }
                >
                  Run browser test
                </button>
                <button onClick={() => void git(details.run.id, "review")}>
                  Review diff
                </button>
                <button onClick={() => void git(details.run.id, "commit")}>
                  Commit
                </button>
                <button onClick={() => void git(details.run.id, "push")}>
                  Push after approval
                </button>
              </div>
              {details.delivery?.review && (
                <pre>
                  {details.delivery.review.diffStat}
                  {"\n"}
                  {details.delivery.review.diff}
                </pre>
              )}
            </>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Approvals({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  return (
    <section className="stack">
      <Panel title="Approval inbox">
        {data.approvals.length ? (
          data.approvals.map((item) => (
            <div className="approval-card" key={item.id}>
              <div className="grow">
                <strong>{pretty(item.kind)} approval</strong>
                <p>{item.detail}</p>
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
                Reject
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
      </Panel>
    </section>
  );
}

function Notifications({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  return (
    <section className="stack">
      <Panel title="Notification centre">
        {data.notifications.length ? (
          data.notifications.map((item) => (
            <div className="approval-card" key={item.key}>
              <div className="grow">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <small>{item.suggestedAction}</small>
              </div>
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
            title="You're caught up"
            copy="Only actionable local reminders appear here."
          />
        )}
      </Panel>
    </section>
  );
}

function Agents({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  return (
    <section className="stack">
      <div className="section-bar">
        <p>
          Roles define responsibility. Providers and models remain replaceable.
        </p>
        <SkillStudio data={data} refresh={refresh} />
      </div>
      <div className="agent-grid">
        {data.roles.map((role) => (
          <article
            className={`agent-card ${role.enabled ? "" : "disabled"}`}
            key={role.id}
          >
            <div className="agent-head">
              <span className="avatar">
                {role.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                <h3>{role.name}</h3>
                <small>
                  {role.builtIn
                    ? "Built-in role"
                    : projectName(data, role.projectId)}
                </small>
              </div>
              <button
                className="toggle"
                aria-label={`${role.enabled ? "Disable" : "Enable"} ${role.name}`}
                data-on={role.enabled}
                onClick={async () => {
                  await window.awenes.setRoleEnabled({
                    roleId: role.id,
                    enabled: !role.enabled,
                  });
                  await refresh();
                }}
              >
                <span />
              </button>
            </div>
            <p>{role.description}</p>
            <div className="tags">
              {role.capabilities.map((cap) => (
                <Badge key={cap} text={pretty(cap)} />
              ))}
            </div>
            <RoleConfig role={role} data={data} refresh={refresh} />
          </article>
        ))}
      </div>
    </section>
  );
}

function RoleConfig({
  role,
  data,
  refresh,
}: {
  role: DesktopSnapshot["roles"][number];
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [provider, setProvider] = useState(role.providerId ?? "");
  const [model, setModel] = useState(role.modelId ?? "");
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [details, setDetails] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const selectedProvider = data.providers.find((item) => item.id === provider);
  async function edit() {
    const [value, available]: any[] = await Promise.all([
      window.awenes.promptDetails(role.id),
      window.awenes.listSkills(role.projectId ?? undefined),
    ]);
    setDetails(value);
    setSkills(available);
    setPrompt(value.effective.prompt.content);
    setEditing(true);
  }
  return (
    <div className="model">
      <span>Provider and model</span>
      <select
        value={provider}
        onChange={(event) => {
          setProvider(event.target.value);
          setModel("");
        }}
      >
        <option value="">Choose provider</option>
        {data.providers
          .filter((item) => item.status === "ready")
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </select>
      <select
        value={model}
        onChange={(event) => setModel(event.target.value)}
        disabled={!selectedProvider || !selectedProvider.models.length}
      >
        <option value="">
          {selectedProvider?.models.length
            ? "Choose model"
            : "Choose a provider first"}
        </option>
        {selectedProvider?.models.map((modelId) => (
          <option key={modelId} value={modelId}>
            {providerModelName(selectedProvider.kind, modelId)}
          </option>
        ))}
      </select>
      <div className="run-actions">
        <button
          disabled={!provider || !model}
          onClick={async () => {
            await window.awenes.assignRoleModel({
              roleId: role.id,
              providerId: provider,
              modelId: model,
            });
            await refresh();
          }}
        >
          Assign
        </button>
        <button onClick={() => void edit()}>Edit prompt</button>
      </div>
      {editing && (
        <div className="prompt-editor">
          <textarea
            rows={8}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          {details?.effective?.warnings?.map((warning: string) => (
            <p className="warning" key={warning}>
              {warning}
            </p>
          ))}
          <small>
            Next version: {(details?.effective?.prompt?.version ?? 0) + 1} ·
            Existing runs keep their snapshot.
          </small>
          <details>
            <summary>Preview effective instructions</summary>
            <pre>{details?.effective?.content}</pre>
            <small>Snapshot hash: {details?.effective?.contentHash}</small>
          </details>
          <div className="skill-list">
            {skills.map((skill) => {
              const attached = details.effective.skills.some(
                (item: any) => item.id === skill.id,
              );
              return (
                <button
                  key={skill.id}
                  className={attached ? "selected" : ""}
                  onClick={async () => {
                    await window.awenes.attachSkill({
                      roleId: role.id,
                      skillId: skill.id,
                      attached: !attached,
                    });
                    await edit();
                  }}
                >
                  {attached ? "✓ " : "+ "}
                  {skill.name} · {skill.version}
                </button>
              );
            })}
          </div>
          <div className="form-actions">
            <button onClick={() => setEditing(false)}>Cancel</button>
            <button
              onClick={async () => {
                await window.awenes.resetPrompt(role.id);
                await edit();
              }}
            >
              Reset to default
            </button>
            <button
              className="primary"
              onClick={async () => {
                await window.awenes.savePrompt({
                  roleId: role.id,
                  content: prompt,
                });
                setEditing(false);
                await refresh();
              }}
            >
              Save new version
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillStudio({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await window.awenes.saveSkill({
      projectId: String(form.get("project")) || null,
      source: String(form.get("source")) as "personal" | "repository",
      slug: String(form.get("slug")),
      name: String(form.get("name")),
      version: String(form.get("version")),
      content: String(form.get("content")),
      permissions: split(String(form.get("permissions"))) as any,
      reviewed: Boolean(form.get("reviewed")),
    });
    setShow(false);
    await refresh();
  }
  return (
    <>
      <button className="ghost" onClick={() => setShow(!show)}>
        + Local skill
      </button>
      {show && (
        <form
          className="form-card floating-form"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Name
            <input name="name" required />
          </label>
          <div className="form-grid">
            <label>
              Source
              <select name="source" defaultValue="personal">
                <option value="personal">Personal skill</option>
                <option value="repository">Repository skill</option>
              </select>
            </label>
            <label>
              Slug
              <input name="slug" required placeholder="my-skill" />
            </label>
            <label>
              Version
              <input name="version" required defaultValue="1.0.0" />
            </label>
          </div>
          <label>
            Project
            <select name="project">
              <option value="">All projects</option>
              {data.projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Instructions
            <textarea name="content" required rows={6} />
          </label>
          <label>
            Permissions
            <input
              name="permissions"
              placeholder="read_repository, write_worktree"
            />
          </label>
          <label className="check">
            <input type="checkbox" name="reviewed" required />I reviewed this
            exact content and its permissions
          </label>
          <button className="primary">Snapshot skill</button>
        </form>
      )}
    </>
  );
}

function Safety({ data }: { data: DesktopSnapshot }) {
  const [selected, setSelected] = useState(data.projects[0]?.id ?? "");
  const [policy, setPolicy] = useState<ExecutionPolicy | null>(null);
  const [readiness, setReadiness] = useState<unknown>(null);
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
              setReadiness(await window.awenes.projectReadiness(selected))
            }
          >
            Run readiness check
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
                        commandAllowlist: split(e.target.value),
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
                        environmentAllowlist: split(e.target.value),
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
              <Panel title="Readiness">
                {readiness ? (
                  <pre>{JSON.stringify(readiness, null, 2)}</pre>
                ) : (
                  <Empty
                    title="Not checked yet"
                    copy="Run the read-only check to verify Git, Node, pnpm, repository access, and worktree support."
                  />
                )}
              </Panel>
            </div>
            <BrowserConfig projectId={selected} />
          </>
        )
      )}
    </section>
  );
}

function BrowserConfig({ projectId }: { projectId: string }) {
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      baseUrl = String(form.get("baseUrl")),
      credentialKey = String(form.get("credentialKey")),
      credentialValue = String(form.get("credentialValue"));
    await window.awenes.saveBrowserConfig({
      projectId,
      baseUrl,
      healthCheckUrl: String(form.get("healthUrl")),
      startCommand: String(form.get("command")),
      startArgs: split(String(form.get("args"))),
      setupCommand: null,
      cleanupCommand: null,
      credentialKeys: credentialKey ? [credentialKey] : [],
      actions: [],
      assertions: [{ type: "status", value: 200 }],
      browserExecutable: String(form.get("browser")),
    });
    if (credentialKey && credentialValue)
      await window.awenes.saveBrowserCredential({
        projectId,
        key: credentialKey,
        value: credentialValue,
      });
    setSaved(true);
  }
  return (
    <Panel title="Localhost browser test">
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label>
            Base URL
            <input
              name="baseUrl"
              required
              placeholder="http://localhost:3000"
            />
          </label>
          <label>
            Health-check URL
            <input
              name="healthUrl"
              required
              placeholder="http://localhost:3000/health"
            />
          </label>
          <label>
            Start command
            <input name="command" required placeholder="pnpm" />
          </label>
          <label>
            Arguments
            <input name="args" placeholder="dev" />
          </label>
          <label>
            Browser executable
            <input
              name="browser"
              required
              defaultValue="C:\Program Files\Google\Chrome\Application\chrome.exe"
            />
          </label>
          <label>
            Credential name
            <input name="credentialKey" placeholder="password" />
          </label>
          <label>
            Credential value
            <input name="credentialValue" type="password" autoComplete="off" />
          </label>
        </div>
        <button className="primary">
          {saved ? "Saved" : "Save browser configuration"}
        </button>
      </form>
    </Panel>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Panel({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <article className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {action && <button onClick={onAction}>{action} →</button>}
      </div>
      {children}
    </article>
  );
}
function Badge({ text }: { text: string }) {
  return <span className="badge">{text}</span>;
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty">
      <span>◇</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
function Guard({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <span>✓</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
function projectName(data: DesktopSnapshot, id: string | null) {
  return data.projects.find((p) => p.id === id)?.name ?? "Unassigned";
}
function taskName(data: DesktopSnapshot, id: string) {
  return data.tasks.find((task) => task.id === id)?.title ?? "Unknown task";
}
function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCheckedAt(value: Date | string) {
  const checkedAt = new Date(value);
  if (Number.isNaN(checkedAt.getTime())) return "successfully";
  return checkedAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
function split(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function title(view: View) {
  return (
    {
      overview: "Command center",
      projects: "Projects",
      tasks: "Task workspace",
      runs: "Workflow runs",
      approvals: "Approval inbox",
      agents: "Agent roles",
      providers: "Model providers",
      notifications: "Notifications",
      safety: "Safety and permissions",
    } as const
  )[view];
}
function icon(view: View) {
  return (
    {
      overview: "⌂",
      projects: "▦",
      tasks: "✓",
      runs: "▶",
      approvals: "!",
      agents: "◎",
      providers: "◉",
      notifications: "◌",
      safety: "◈",
    } as const
  )[view];
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
