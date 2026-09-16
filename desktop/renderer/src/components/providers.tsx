import { useEffect, useState, type FormEvent } from "react";
import type { DesktopSnapshot } from "../../../contracts";
import { PROVIDER_MODELS } from "../../../../src/domain/provider-model";
import { Badge, Empty, Pagination } from "./ui";
import { usePagination } from "../hooks/use-pagination";
import { formatCheckedAt, pretty } from "../utils/presentation";

export function Providers({
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
            title="No Model Provider Connected"
            copy="API keys are encrypted locally. CLI mode uses the provider tool's own supported login."
          />
        )}
        <Pagination {...providerPage} label="providers" />
      </div>
    </section>
  );
}
