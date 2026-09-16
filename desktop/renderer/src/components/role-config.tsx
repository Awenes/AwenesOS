import { useState } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { providerModelName } from "../../../../src/domain/provider-model";

export function RoleConfig({
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
