import { useState, type FormEvent } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import type { SkillPermission } from "../../../../src/domain/instruction";
import { SKILL_PERMISSIONS } from "../../../../src/domain/skill-permission";
import { MultiSelect } from "./multi-select";

export function SkillStudio({
  data,
  refresh,
}: {
  data: DesktopSnapshot;
  refresh: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [permissions, setPermissions] = useState<SkillPermission[]>([]);
  function open() {
    setPermissions([]);
    setShow(true);
  }
  function cancel() {
    setPermissions([]);
    setShow(false);
  }
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
      permissions,
      reviewed: Boolean(form.get("reviewed")),
    });
    setPermissions([]);
    setShow(false);
    await refresh();
  }
  return (
    <>
      <button className="ghost" onClick={() => (show ? cancel() : open())}>
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
            <MultiSelect
              label="Skill permissions"
              options={SKILL_PERMISSIONS}
              selected={permissions}
              onChange={(next) => setPermissions(next as SkillPermission[])}
              placeholder="No permissions selected"
            />
          </label>
          <label className="check">
            <input type="checkbox" name="reviewed" required />I reviewed this
            exact content and its permissions
          </label>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={cancel}>
              Cancel
            </button>
            <button className="primary">Snapshot skill</button>
          </div>
        </form>
      )}
    </>
  );
}
