import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProviderConnection, ProviderProbe } from "../../domain/provider.js";

const execute = promisify(execFile);

export class LocalProviderProbe implements ProviderProbe {
  async check(connection: ProviderConnection, secret: string | null): Promise<{ ready: boolean; detail: string }> {
    try {
      if (connection.authMethod === "api_key") return await checkApi(connection, secret);
      const expected = connection.kind === "openai" ? "codex" : "claude";
      const command = connection.command?.replace(/\.cmd$/i, "").split(/[\\/]/).at(-1)?.toLowerCase();
      if (command !== expected) return { ready: false, detail: `${connection.kind} CLI connections must use ${expected}` };
      const args = connection.kind === "openai" ? ["login", "status"] : ["auth", "status"];
      await execute(connection.command!, args, { timeout: 15_000, windowsHide: true, env: minimalPathEnvironment() });
      return { ready: true, detail: `${expected} is installed and signed in` };
    } catch (error) {
      return { ready: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
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
