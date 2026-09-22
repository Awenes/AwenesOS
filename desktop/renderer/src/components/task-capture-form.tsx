import type { FormEvent } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { splitLines } from "../utils/presentation";

export function TaskCaptureForm({
  projects,
  onCancel,
  onCaptured,
}: {
  projects: DesktopSnapshot["projects"];
  onCancel: () => void;
  onCaptured: () => Promise<void>;
}) {
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
    await onCaptured();
  }

  return (
    <form className="form-card" onSubmit={(event) => void submit(event)}>
      <label>
        Task title
        <input name="title" required placeholder="Fix checkout validation" />
      </label>
      <label>
        Project
        <select name="project" required defaultValue="">
          <option value="" disabled>
            Choose project
          </option>
          {projects.map((p) => (
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
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary">Start task</button>
      </div>
    </form>
  );
}
