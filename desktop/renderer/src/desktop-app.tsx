import { useEffect, useState } from "react";
import { ActivityIndicator, Toast } from "./components/feedback";
import { Safety } from "./components/safety";
import { Runs } from "./components/workflow-runs";
import { AppSidebar } from "./components/app-sidebar";
import { Overview } from "./components/overview";
import { Projects } from "./components/projects";
import { Tasks } from "./components/tasks";
import { Approvals } from "./components/approvals";
import { Notifications } from "./components/notifications";
import { Agents } from "./components/agents";
import { Providers } from "./components/providers";
import { useDesktopState } from "./hooks/use-desktop-state";
import { type View, viewDescription, viewTitle } from "./utils/presentation";

export function DesktopApp() {
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
      <AppSidebar view={view} collapsed={sidebarCollapsed} setView={setView} toggle={() => setSidebarCollapsed((value) => !value)} snapshot={snapshot} />
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
            <span>We could not refresh the workspace. Try again or review the details below.<details><summary>Technical details</summary><small>{error}</small></details></span>
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
