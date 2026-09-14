import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProviderConnection, ProviderProbe, ProviderProbeResult } from "../../domain/provider.js";
import { LocalProviderCommandLocator, type ProviderCommandLocator } from "./local-provider-command.js";

const execute = promisify(execFile);
type ExecuteCommand = (
  command: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

export class LocalProviderProbe implements ProviderProbe {
  constructor(
    private readonly locator: ProviderCommandLocator = new LocalProviderCommandLocator(),
    private readonly executeCommand: ExecuteCommand = async (command, args, options) => execute(command, args, options),
  ) {}

  async check(connection: ProviderConnection, secret: string | null): Promise<ProviderProbeResult> {
    let resolvedCommand = connection.command ?? "";
    try {
      if (connection.authMethod === "api_key") return await checkApi(connection, secret);
      const expected = connection.kind === "openai" ? "codex" : "claude";
      resolvedCommand = await this.locator.resolve(connection.kind, connection.command!);
      const command = resolvedCommand.replace(/\.(?:cmd|exe|bat)$/i, "").split(/[\\/]/).at(-1)?.toLowerCase();
      if (command !== expected) return { ready: false, detail: `${connection.kind} CLI connections must use ${expected}` };
      const args = connection.kind === "openai" ? ["login", "status"] : ["auth", "status"];
      await this.executeCommand(resolvedCommand, args, { timeout: 15_000, windowsHide: true, env: minimalPathEnvironment() });
      return { ready: true, detail: `${expected} is installed and signed in`, resolvedCommand };
    } catch (error) {
      return { ready: false, detail: cliFailureDetail(connection, error), ...(resolvedCommand ? { resolvedCommand } : {}) };
    }
  }
}

function cliFailureDetail(connection: ProviderConnection, error: unknown): string {
  const provider = connection.kind === "openai" ? "Codex" : "Claude";
  const command = connection.command ?? provider.toLowerCase();
  const systemError = error as NodeJS.ErrnoException;

  if (systemError?.code === "ENOENT") {
    return `${provider} CLI was not found. Install ${provider} CLI and sign in, or enter its full executable path, then try again. AwenesOS looked for "${command}".`;
  }
  if (systemError?.code === "ETIMEDOUT" || (systemError as { killed?: boolean })?.killed) {
    return `${provider} CLI did not respond within 15 seconds. Confirm it opens normally in a terminal, then try again.`;
  }

  const output = [
    (systemError as { stderr?: string })?.stderr,
    error instanceof Error ? error.message : String(error),
  ]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
  if (output && /not logged in|not signed in|not authenticated|login required/i.test(output)) {
    return `${provider} CLI is installed but not signed in. Sign in with ${command}, then try verification again.`;
  }
  return `${provider} CLI is installed, but AwenesOS could not verify its login. Sign in with the CLI, then try again${output ? `: ${output}` : "."}`;
}

async function checkApi(connection: ProviderConnection, secret: string | null) {
  if (!secret) return { ready: false, detail: "Credential is missing" };
  const openAi = connection.kind === "openai";
  const response = await fetch(openAi ? "https://api.openai.com/v1/models" : "https://api.anthropic.com/v1/models?limit=1", {
    headers: openAi ? { authorization: `Bearer ${secret}` } : { "x-api-key": secret, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(15_000)
  });
  return response.ok ? { ready: true, detail: "Credential verified" } : { ready: false, detail: `Provider returned HTTP ${response.status}` };
}

function minimalPathEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR"].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
}
