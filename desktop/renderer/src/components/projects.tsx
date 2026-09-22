import { useState, type FormEvent } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { Badge, Empty, Pagination } from "./ui";
import { usePagination } from "../hooks/use-pagination";
import { folderName, pluralize, pretty } from "../utils/presentation";

export function Projects({
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
                  text={pluralize(
                    data.tasks.filter((t) => t.projectId === project.id).length,
                    "task",
                  )}
                />
              </div>
            </div>
          </article>
        ))}
        {!data.projects.length && (
          <Empty
            title="Your Projects Will Appear Here"
            copy="Register a local Git repository. Awenes only records it; no agent will run automatically."
          />
        )}
        <Pagination {...projectPage} label="projects" />
      </div>
    </section>
  );
}
