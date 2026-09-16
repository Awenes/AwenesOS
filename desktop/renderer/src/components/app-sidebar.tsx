import type { DesktopSnapshot } from "../../../contracts";
import { navigation, type View } from "../utils/presentation";
import { NavigationIcon } from "./navigation-icon";

interface AppSidebarProps {
  view: View;
  collapsed: boolean;
  setView: (view: View) => void;
  toggle: () => void;
  snapshot: DesktopSnapshot;
}

export function AppSidebar({ view, collapsed, setView, toggle, snapshot }: AppSidebarProps) {
  const groups = [
    { label: "Workspace", items: navigation.slice(0, 5) },
    { label: "Configure", items: navigation.slice(5) },
  ];
  const count = (id: View) => {
    if (id === "tasks") return snapshot.tasks.filter((task) => ["planned", "in_progress", "paused", "ready_to_complete", "sync_pending"].includes(task.status)).length;
    if (id === "runs") return snapshot.runs.filter((run) => ["running", "paused", "awaiting_approval"].includes(run.status)).length;
    if (id === "approvals") return snapshot.approvals.length;
    return 0;
  };
  return <aside className="sidebar">
    <div className="sidebar-head">
      <div className="brand"><span className="brand-mark">A</span><div className="brand-copy"><strong>AwenesOS</strong><small>Developer command center</small></div></div>
      <button type="button" className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggle}>{collapsed ? "»" : "«"}</button>
    </div>
    <nav aria-label="Primary navigation">
      {groups.map((group) => <div className="nav-group" key={group.label}>
        <small>{group.label}</small>
        {group.items.map(([id, label]) => <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} onClick={() => setView(id)}>
          <span aria-hidden="true"><NavigationIcon view={id} /></span><span className="nav-label">{label}</span>{count(id) > 0 ? <em>{count(id)}</em> : null}
        </button>)}
      </div>)}
    </nav>
    <div className="sidebar-foot"><span className="status-dot"/><span className="sidebar-status-text">Local engine online</span><small>{snapshot.projects.length} projects connected</small></div>
  </aside>;
}
