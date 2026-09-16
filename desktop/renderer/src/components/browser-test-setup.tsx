import { useEffect, useState, type FormEvent } from "react";
import type { BrowserSetupSuggestion } from "../../../../src/domain/browser-test";
import { Panel } from "./ui";
import { splitCommaSeparated } from "../utils/presentation";

interface SetupFields {
  baseUrl: string;
  healthUrl: string;
  command: string;
  args: string;
  browser: string;
}

const empty: SetupFields = { baseUrl: "", healthUrl: "", command: "", args: "", browser: "" };

export function BrowserTestSetup({ projectId }: { projectId: string }) {
  const [fields, setFields] = useState<SetupFields>(empty);
  const [suggestion, setSuggestion] = useState<BrowserSetupSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFields(empty);
    setSuggestion(null);
    setConfirmed(false);
    setSaved(false);
    setError(null);
  }, [projectId]);

  async function detect() {
    setLoading(true);
    setError(null);
    try {
      const result = await window.awenes.suggestBrowserConfig(projectId);
      setSuggestion(result);
      setFields({ baseUrl: result.baseUrl, healthUrl: result.healthCheckUrl, command: result.startCommand, args: result.startArgs.join(", "), browser: result.browserExecutable });
      setConfirmed(false);
      setSaved(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  function change(key: keyof SetupFields, value: string) {
    setFields((current) => ({ ...current, [key]: value, ...(key === "baseUrl" && (!current.healthUrl || current.healthUrl === current.baseUrl) ? { healthUrl: value } : {}) }));
    setConfirmed(false);
    setSaved(false);
  }

  function chooseScript(name: string) {
    const args = splitCommaSeparated(fields.args);
    if (args.length) args[args.length - 1] = name;
    setFields((current) => ({ ...current, args: args.join(", ") }));
    setConfirmed(false);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const credentialKey = String(form.get("credentialKey")).trim();
      const credentialValue = String(form.get("credentialValue"));
      await window.awenes.saveBrowserConfig({ confirmLocalhostAccess: true, config: {
        projectId,
        baseUrl: fields.baseUrl,
        healthCheckUrl: fields.healthUrl,
        startCommand: fields.command,
        startArgs: splitCommaSeparated(fields.args),
        setupCommand: null,
        cleanupCommand: null,
        credentialKeys: credentialKey ? [credentialKey] : [],
        actions: [],
        assertions: [{ type: "status", value: 200 }],
        browserExecutable: fields.browser,
      } });
      if (credentialKey && credentialValue) await window.awenes.saveBrowserCredential({ projectId, key: credentialKey, value: credentialValue });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return <Panel title="Localhost Browser Test">
    <p>Find a starting point from your project, then review it before saving. Nothing starts during detection.</p>
    <button type="button" className="ghost" onClick={() => void detect()} disabled={loading || saving}>{loading ? "Checking project setup…" : "Suggest setup from project"}</button>
    {suggestion?.warnings.map((warning) => <p className="setup-warning" key={warning}>{warning}</p>)}
    {suggestion && suggestion.scriptOptions.length > 1 && <label>Server script<select onChange={(event) => chooseScript(event.target.value)}>{suggestion.scriptOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}
    {error && <div role="alert" className="setup-error">Could not save browser setup. Check the fields below.<details><summary>Technical details</summary><pre>{error}</pre></details></div>}
    <form onSubmit={(event) => void submit(event)}>
      <details open={!suggestion || suggestion.warnings.length > 0}>
        <summary>Review or edit setup fields</summary>
      <div className="form-grid">
        <label>Base URL<input name="baseUrl" type="url" required placeholder="http://localhost:3000" value={fields.baseUrl} onChange={(event) => change("baseUrl", event.target.value)} /></label>
        <label>Health-check URL<input name="healthUrl" type="url" required placeholder="Use the base URL if there is no health endpoint" value={fields.healthUrl} onChange={(event) => change("healthUrl", event.target.value)} /></label>
        <label>Start command<input name="command" required placeholder="pnpm" value={fields.command} onChange={(event) => change("command", event.target.value)} /></label>
        <label>Arguments, separated by commas<input name="args" placeholder="dev" value={fields.args} onChange={(event) => change("args", event.target.value)} /></label>
        <label>Browser executable<input name="browser" required placeholder="Path to Chrome or Edge" value={fields.browser} onChange={(event) => change("browser", event.target.value)} /></label>
        <label>Credential name, if needed<input name="credentialKey" placeholder="password" /></label>
        <label>Credential value, if needed<input name="credentialValue" type="password" autoComplete="off" /></label>
      </div>
      </details>
      <p>Command preview: <code>{fields.command || "[command]"} {fields.args.replaceAll(",", " ")}</code>.</p>
      <p>Open <code>{fields.baseUrl || "[localhost URL]"}</code> in <code>{fields.browser || "[Chrome or Edge]"}</code>. The server starts inside the task worktree. Public network access is unchanged.</p>
      <label className="setup-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I reviewed this command and localhost access.</label>
      <button className="primary" disabled={!confirmed || saving}>{saving ? "Saving setup…" : saved ? "Saved, update setup" : "Save browser setup"}</button>
    </form>
  </Panel>;
}
