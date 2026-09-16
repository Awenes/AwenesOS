import { useEffect, useState, type FormEvent } from "react";
import type { DesktopSnapshot } from "../../contracts";
import type { ExecutionPolicy } from "../../../src/domain/project";
import {
  PROVIDER_MODELS,
  providerModelName,
} from "../../../src/domain/provider-model";
import { ActivityIndicator, Toast } from "./components/feedback";
import {
  Badge,
  Empty,
  Guard,
  Metric,
  Pagination,
  Panel,
} from "./components/ui";
import { useDesktopState } from "./hooks/use-desktop-state";
import { usePagination } from "./hooks/use-pagination";
import {
  folderName,
  formatCheckedAt,
  navigation,
  pretty,
  projectName,
  splitCommaSeparated,
  splitLines,
  taskName,
  type View,
  viewDescription,
  viewIcon,
  viewTitle,
} from "./utils/presentation";

export function App() {
  const [view, setView] = useState<View>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem("awenes.sidebar.collapsed");
    return saved === null ? window.matchMedia("(max-width: 1080px)").matches : saved === "true";
  });
  useEffect(() => {
    window.localStorage.setItem("awenes.sidebar.collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const [taskReview, setTaskReview] = useState<{ id: string; request: number } | null>(null);
  function openTaskReview(id: string) {
    setTaskReview({ id, request: Date.now() });
    setView("tasks");
  }
  const {
    snapshot,
    loading,
    pendingOperations,
    error,
    toast,
    dismissToast,
    dismissError,
    refresh,
  } = useDesktopState();
  const active = snapshot.tasks.filter((task) =>
    [
      "planned",
      "in_progress",
      "paused",
      "ready_to_complete",
      "sync_pending",
    ].includes(task.status),
  );
  const navigationGroups = [
    { label: "Workspace", items: navigation.slice(0, 5) },
    { label: "Configure", items: navigation.slice(5) },
  ];
  const navigationCount = (id: View) => {
    if (id === "tasks") return active.length;
    if (id === "runs")
      return snapshot.runs.filter((run) =>
        ["running", "paused", "awaiting_approval"].includes(run.status),
      ).length;
    if (id === "approvals") return snapshot.approvals.length;
    return 0;
  };
  return (
    <div
      className={`shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      aria-busy={loading || pendingOperations > 0}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <ActivityIndicator visible={loading || pendingOperations > 0} />
      <Toast value={toast} dismiss={dismissToast} />
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">A</span>
            <div className="brand-copy">
              <strong>AwenesOS</strong>
              <small>Developer command center</small>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <small>{group.label}</small>
              {group.items.map(([id, label]) => {
                const count = navigationCount(id);
                return (
                  <button
                    key={id}
                    className={view === id ? "active" : ""}
                    aria-current={view === id ? "page" : undefined}
                    aria-label={sidebarCollapsed ? label : undefined}
                    title={sidebarCollapsed ? label : undefined}
                    onClick={() => setView(id)}
                  >
                    <span aria-hidden="true">{viewIcon(id)}</span>
                    <span className="nav-label">{label}</span>
                    {count > 0 ? <em>{count}</em> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" />
          <span className="sidebar-status-text">Local engine online</span>
          <small>{snapshot.projects.length} projects connected</small>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <header>
          <div className="page-heading">
            <p className="eyebrow">LOCAL-FIRST WORKSPACE</p>
            <h1>{viewTitle(view)}</h1>
            <p className="page-description">{viewDescription(view)}</p>
          </div>
          <div className="header-actions">
            {view === "overview" && (
              <button className="primary" onClick={() => setView("tasks")}>
                + New task
              </button>
            )}
            <button
              className="ghost"
              onClick={() => void refresh(true)}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void window.awenes.exportData()}
            >
              Export data
            </button>
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            <strong>Something needs attention</strong>
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={dismissError}
            >
              ×
            </button>
          </div>
        )}
        {view === "overview" && (
          <Overview data={snapshot} active={active} navigate={setView} />
        )}
        {view === "projects" && <Projects data={snapshot} refresh={refresh} />}
        {view === "tasks" && (
          <Tasks data={snapshot} refresh={refresh} reviewTarget={taskReview} />
        )}
        {view === "runs" && (
          <Runs data={snapshot} refresh={refresh} reviewTask={openTaskReview} />
        )}
        {view === "approvals" && (
          <Approvals data={snapshot} refresh={refresh} />
        )}
        {view === "agents" && <Agents data={snapshot} refresh={refresh} />}
        {view === "providers" && (
          <Providers data={snapshot} refresh={refresh} />
        )}
        {view === "notifications" && (
          <Notifications data={snapshot} refresh={refresh} reviewTask={openTaskReview} />
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
  const providerPage = usePagination(data.providers);
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
                Use this option only if you already use{" "}
                {kind === "openai" ? "Codex" : "Claude"} from a terminal on this
                computer. AwenesOS will reuse that sign-in; it will not open a
                new login window.
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
                  Keep the default. AwenesOS searches your Windows PATH and
                  supported Codex or Claude installation folders automatically.
                  Enter a complete executable path only for a custom
                  installation.
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
        {providerPage.items.map((provider) => (
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
        <Pagination {...providerPage} label="providers" />
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
          onClick={() => navigate("projects")}
        />
        <Metric
          label="Active work"
          value={active.length}
          note="Across all projects"
          tone="violet"
          onClick={() => navigate("tasks")}
        />
        <Metric
          label="Agent runs"
          value={data.runs.length}
          note="Workflow history"
          tone="amber"
          onClick={() => navigate("runs")}
        />
        <Metric
          label="Approvals"
          value={data.approvals.length}
          note="Waiting for you"
          tone="green"
          onClick={() => navigate("approvals")}
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
            copy="Tasks close only after evidence and your chosen delivery gate."
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
  const [projectNameValue, setProjectNameValue] = useState("");
  const projectPage = usePagination(data.projects);
  const [choosingFolder, setChoosingFolder] = useState(false);
  async function chooseFolder() {
    setChoosingFolder(true);
    try {
      const selected = await window.awenes.selectProjectDirectory();
      if (selected) {
        setRepositoryRoot(selected);
        setProjectNameValue(folderName(selected));
      }
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
      autonomyMode: String(form.get("autonomy")) as
        "guided" | "balanced" | "autonomous",
      initializeGit: form.get("initializeGit") === "on",
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
            <input
              name="name"
              required
              placeholder="Customer portal"
              value={projectNameValue}
              onChange={(event) => setProjectNameValue(event.target.value)}
            />
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
          <label className="check permission-choice">
            <input type="checkbox" name="initializeGit" />
            <span>
              Create a local Git repository if this folder does not have one
              <small>
                AwenesOS will run Git init only after you select this option.
              </small>
            </span>
          </label>
          <div className="form-grid three">
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
            <label>
              Operating mode
              <select name="autonomy" defaultValue="balanced">
                <option value="guided">Guided · ask at each decision</option>
                <option value="balanced">Balanced · ask when it matters</option>
                <option value="autonomous">
                  Autonomous · work until review
                </option>
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
        {projectPage.items.map((project) => (
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
                <Badge text={`${pretty(project.autonomyMode)} mode`} />
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
        <Pagination {...projectPage} label="projects" />
      </div>
    </section>
  );
}

function Tasks({
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
            copy="Capture work manually or import candidates through the CLI."
          />
        )}
        <Pagination {...taskPage} label="tasks" />
      </Panel>
      {details && (
        <div id="task-review">
        <Panel title={`Task details · ${details.task.title}`}>
          {details.workflow?.run.status === "completed" &&
            details.task.status !== "completed" && (
              <div className="completion-review">
                <div className="completion-review-head">
                  <Badge text="Agent run complete" />
                  <strong>Your review is the final step</strong>
                </div>
                <p>
                  The agents have finished, but this task remains open until you review the evidence,
                  save a completion summary, and choose to mark it complete.
                </p>
              </div>
            )}
          {details.workflow && (
            <div className="cockpit">
              <div className="cockpit-head">
                <div>
                  <small>Workflow</small>
                  <strong>
                    {details.workflow.run.status === "running"
                      ? "AwenesOS is working"
                      : pretty(details.workflow.run.status)}
                  </strong>
                </div>
                <Badge
                  text={pretty(
                    details.workflow.run.currentStage ?? "not started",
                  )}
                />
              </div>
              <div className="stage-track">
                {details.workflow.steps.map((step: any) => (
                  <div key={step.id} data-state={step.status}>
                    <span>
                      {step.status === "passed"
                        ? "✓"
                        : step.status === "running"
                          ? "●"
                          : "○"}
                    </span>
                    <small>{pretty(step.stage)}</small>
                  </div>
                ))}
              </div>
              {details.workflow.plans?.[0] && (
                <details
                  className="plan-details"
                  open={
                    details.workflow.plans[0].status === "awaiting_approval"
                  }
                >
                  <summary>
                    Plan v{details.workflow.plans[0].version} ·{" "}
                    {pretty(details.workflow.plans[0].status)}
                  </summary>
                  <pre>{details.workflow.plans[0].content}</pre>
                </details>
              )}
              {details.workflow.interventions
                ?.filter((item: any) => item.status === "open")
                .map((item: any) => (
                  <div className="intervention" key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))}
            </div>
          )}
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
          {details.workflow?.run.status === "completed" && (
            <div className="completion-evidence">
              <h3>Agent evidence</h3>
              {details.workflow.steps
                .filter((step: any) => step.output)
                .map((step: any) => (
                  <details key={step.id}>
                    <summary>{pretty(step.stage)} · {pretty(step.status)}</summary>
                    <pre>{step.output}</pre>
                  </details>
                ))}
              {details.workflow.delivery?.review && (
                <details>
                  <summary>Git diff review</summary>
                  <pre>{details.workflow.delivery.review.diff || "No uncommitted changes in this worktree."}</pre>
                </details>
              )}
              {details.workflow.browserEvidence?.length > 0 && (
                <details>
                  <summary>Browser validation ({details.workflow.browserEvidence.length})</summary>
                  <pre>{JSON.stringify(details.workflow.browserEvidence, null, 2)}</pre>
                </details>
              )}
              {!details.evidence.length && (
                <p className="muted">No separate task evidence has been recorded. Inspect the agent outputs before completing this task.</p>
              )}
            </div>
          )}
          {details.workflow?.run.status === "completed" &&
            ["in_progress", "paused", "ready_to_complete"].includes(details.task.status) && (
              <div className="completion-review">
                <h3>Completion summary</h3>
                <p>Review and edit this draft. Saving it does not mark the task complete.</p>
                <label>
                  What was completed and verified?
                  <textarea
                    rows={8}
                    value={completionDraft}
                    onChange={(event) => setCompletionDraft(event.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="ghost"
                    disabled={reviewBusy || !completionDraft.trim()}
                    onClick={() => void saveReview()}
                  >
                    {details.task.status === "ready_to_complete" ? "Save changes" : "Save review"}
                  </button>
                  <button
                    className="primary"
                    disabled={reviewBusy || details.task.status !== "ready_to_complete" ||
                      completionDraft.trim() !== (details.task.completionDescription ?? "").trim()}
                    title={details.task.status !== "ready_to_complete"
                      ? "Save the completion review first"
                      : "Save any edits before finishing"}
                    onClick={() => void finishReview()}
                  >
                    Mark task complete
                  </button>
                </div>
              </div>
            )}
          <button className="ghost" onClick={() => setDetails(null)}>
            Close details
          </button>
        </Panel>
        </div>
      )}
    </section>
  );
}

function Runs({
  data,
  refresh,
  reviewTask,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
  reviewTask: (taskId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [executingStage, setExecutingStage] = useState<string | null>(null);
  const [executionSeconds, setExecutionSeconds] = useState(0);
  const visibleRuns = scope === "active" ? data.runs : data.archivedRuns;
  const runPage = usePagination(visibleRuns);
  const selectedProject = data.projects.find(
    (project) => project.id === details?.run?.projectId,
  );
  const automatedDelivery =
    selectedProject?.completionPolicy !== undefined &&
    selectedProject.completionPolicy !== "manual";
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
    action: "next" | "pause" | "resume" | "cancel" | "archive" | "restore" | "delete",
  ) {
    setBusy(true);
    if (action === "next")
      setExecutingStage(details?.run.currentStage ?? "stage");
    try {
      await window.awenes.runAction({ runId, action });
      await refresh();
      await open(runId);
    } finally {
      setExecutingStage(null);
      setBusy(false);
    }
  }
  async function remove(runId: string, action: "archive" | "restore" | "delete") {
    if (action === "delete" && !window.confirm("Delete this run? Its audit tombstone will be retained.")) return;
    setBusy(true);
    try {
      await window.awenes.runAction({ runId, action });
      setSelected(null);
      setDetails(null);
      await refresh();
    } finally {
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
          <div className="segmented">
            <button className={scope === "active" ? "active" : ""} onClick={() => { setScope("active"); setSelected(null); setDetails(null); }}>Active</button>
            <button className={scope === "archived" ? "active" : ""} onClick={() => { setScope("archived"); setSelected(null); setDetails(null); }}>Archived</button>
          </div>
          {visibleRuns.length ? (
            runPage.items.map((run) => (
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
          <Pagination {...runPage} label="runs" />
        </Panel>
        <Panel title="Run inspector">
          {!details ? (
            <Empty
              title="Select a run"
              copy="Inspect snapshotted instructions, attempts, approvals, evidence, and delivery."
            />
          ) : (
            <>
              {details.run.status === "completed" &&
                data.tasks.some((task) =>
                  task.id === details.run.taskId && task.status !== "completed",
                ) && (
                  <div className="completion-review">
                    <strong>Agent run complete · Task still open</strong>
                    <p>Review the evidence and completion summary before marking the task complete.</p>
                    <button className="primary" onClick={() => reviewTask(details.run.taskId)}>
                      Review task completion →
                    </button>
                  </div>
                )}
              <div className="run-actions">
                {scope === "active" && ["failed", "completed", "cancelled"].includes(details.run.status) && (
                  <button className="ghost" disabled={busy} onClick={() => void remove(details.run.id, "archive")}>Archive</button>
                )}
                {scope === "archived" && (
                  <button className="ghost" disabled={busy} onClick={() => void remove(details.run.id, "restore")}>Restore</button>
                )}
                {["failed", "completed", "cancelled"].includes(details.run.status) && (
                  <button className="danger" disabled={busy} onClick={() => void remove(details.run.id, "delete")}>Delete</button>
                )}
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
                  disabled={busy || !["running", "awaiting_approval"].includes(details.run.status)}
                  onClick={() => void action(details.run.id, "pause")}
                >
                  Pause
                </button>
                <button
                  disabled={busy || !["paused", "failed"].includes(details.run.status)}
                  onClick={() => void action(details.run.id, "resume")}
                >
                  Resume
                </button>
                <button
                  disabled={busy || ["completed", "cancelled"].includes(details.run.status)}
                  onClick={() => void action(details.run.id, "cancel")}
                >
                  Cancel
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
                  disabled={busy || !details.browserConfigured}
                  title={
                    details.browserConfigured
                      ? "Run the saved localhost browser validation"
                      : "Configure localhost browser testing in Safety first"
                  }
                  onClick={() =>
                    void window.awenes
                      .runBrowserTest(details.run.id)
                      .then(() => open(details.run.id))
                  }
                >
                  {details.browserConfigured
                    ? "Run browser test"
                    : "Browser test not configured"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void git(details.run.id, "review")}
                >
                  Review diff
                </button>
                {automatedDelivery && (
                  <>
                    <button
                      disabled={busy || !details.delivery?.review?.status}
                      title={
                        details.delivery?.review?.status
                          ? "Commit the reviewed changes"
                          : "Review a non-empty diff before committing"
                      }
                      onClick={() => void git(details.run.id, "commit")}
                    >
                      Commit
                    </button>
                    <button
                      disabled={busy || !details.delivery?.commitSha}
                      title={
                        details.delivery?.commitSha
                          ? "Push the approved commit"
                          : "Commit the reviewed changes before pushing"
                      }
                      onClick={() => void git(details.run.id, "push")}
                    >
                      Push after approval
                    </button>
                  </>
                )}
              </div>
              {!details.browserConfigured && (
                <p className="muted">
                  Browser validation becomes available after its localhost
                  settings are saved in Safety.
                </p>
              )}
              {!automatedDelivery && (
                <p className="muted">
                  This project uses manual delivery. Review remains available,
                  while you control Git commit and push outside AwenesOS.
                </p>
              )}
              {details.delivery?.review && (
                <pre>
                  {details.delivery.review.status
                    ? `${details.delivery.review.diffStat}\n${details.delivery.review.diff}`
                    : "No uncommitted changes were found in this task worktree."}
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

function Notifications({
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
      <Panel title="Notification centre">
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
            title="You're caught up"
            copy="Only actionable local reminders appear here."
          />
        )}
        <Pagination {...notificationPage} label="notifications" />
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
  const rolePage = usePagination(data.roles, undefined, 6);
  return (
    <section className="stack">
      <div className="section-bar">
        <p>
          Roles define responsibility. Providers and models remain replaceable.
        </p>
        <SkillStudio data={data} refresh={refresh} />
      </div>
      <div className="agent-grid">
        {rolePage.items.map((role) => (
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
        <Pagination {...rolePage} label="agents" />
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
      permissions: splitCommaSeparated(String(form.get("permissions"))) as any,
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
      startArgs: splitCommaSeparated(String(form.get("args"))),
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
