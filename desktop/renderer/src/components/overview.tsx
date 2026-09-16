import type { DesktopSnapshot } from "../../../contracts";
import { Badge, Empty, Guard, Metric, Pagination, Panel } from "./ui";
import { usePagination } from "../hooks/use-pagination";
import { pretty, projectName, type View } from "../utils/presentation";

export function Overview({
  data,
  active,
  navigate,
}: {
  data: DesktopSnapshot;
  active: DesktopSnapshot["tasks"];
  navigate: (view: View) => void;
}) {
  const activePage = usePagination(active, undefined, 5);
  const projectPage = usePagination(data.projects, undefined, 5);
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
          label="Active Work"
          value={active.length}
          note="Across all projects"
          tone="violet"
          onClick={() => navigate("tasks")}
        />
        <Metric
          label="Agent Runs"
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
          title="Current Work"
          action="Open tasks"
          onAction={() => navigate("tasks")}
        >
          {active.length ? (
            <>
              {activePage.items.map((task) => (
                <div className="row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{projectName(data, task.projectId)}</small>
                  </div>
                  <Badge text={pretty(task.status)} />
                </div>
              ))}
              <Pagination {...activePage} label="tasks" />
            </>
          ) : (
            <Empty
              title="No Active Work"
              copy="Claim a captured task when you're ready to begin."
            />
          )}
        </Panel>
        <Panel
          title="Project Health"
          action="Review safety"
          onAction={() => navigate("safety")}
        >
          {data.projects.length ? (
            <>
              {projectPage.items.map((project) => (
                <div className="row" key={project.id}>
                  <div>
                    <strong>{project.name}</strong>
                    <small>
                      {project.defaultBranch} · {pretty(project.completionPolicy)}
                    </small>
                  </div>
                  <span className="healthy">Ready to inspect</span>
                </div>
              ))}
              <Pagination {...projectPage} label="projects" />
            </>
          ) : (
            <Empty
              title="No Projects Registered"
              copy="Add your first local repository to begin."
            />
          )}
        </Panel>
      </div>
      <Panel title="How Awenes Protects Your Work">
        <div className="guardrails">
          <Guard
            title="Dedicated Worktrees"
            copy="Agents never write in your normal checkout."
          />
          <Guard
            title="Approval-Aware Delivery"
            copy="Push behavior follows each project's policy."
          />
          <Guard
            title="Evidence Before Completion"
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
    <Panel title="Finish Setup">
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
