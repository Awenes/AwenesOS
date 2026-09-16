import type { DesktopSnapshot } from "../../../contracts";
import { Badge, Pagination } from "./ui";
import { RoleConfig } from "./role-config";
import { SkillStudio } from "./skill-studio";
import { usePagination } from "../hooks/use-pagination";
import { pretty, projectName } from "../utils/presentation";

export function Agents({
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
