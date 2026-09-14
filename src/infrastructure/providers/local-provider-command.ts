import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ProviderKind } from "../../domain/provider.js";

const execute = promisify(execFile);

export interface ProviderCommandLocator {
  resolve(kind: ProviderKind, configuredCommand: string): Promise<string>;
}

export class LocalProviderCommandLocator implements ProviderCommandLocator {
  async resolve(kind: ProviderKind, configuredCommand: string) {
    if (isPath(configuredCommand)) return configuredCommand;
    const fromPath = await locateOnPath(configuredCommand);
    if (fromPath) return fromPath;
    for (const candidate of await installationCandidates(kind)) {
      if (await executableExists(candidate)) return candidate;
    }
    return configuredCommand;
  }
}

function isPath(command: string) {
  return /[\\/]/.test(command);
}

async function locateOnPath(command: string) {
  try {
    const locator = process.platform === "win32" ? "where.exe" : "which";
    const { stdout } = await execute(locator, [command], { timeout: 5_000, windowsHide: true });
    return stdout.split(/\r?\n/).map((value) => value.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

async function installationCandidates(kind: ProviderKind) {
  const profile = process.env.USERPROFILE ?? "";
  const local = process.env.LOCALAPPDATA ?? "";
  const roaming = process.env.APPDATA ?? "";
  if (kind === "anthropic") {
    return [
      join(profile, ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude"),
      join(roaming, "npm", process.platform === "win32" ? "claude.cmd" : "claude"),
      join(local, "Programs", "claude", process.platform === "win32" ? "claude.exe" : "claude"),
    ];
  }
  const root = join(local, "OpenAI", "Codex", "bin");
  try {
    const versions = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    return versions.map((version) => join(root, version, process.platform === "win32" ? "codex.exe" : "codex"));
  } catch {
    return [];
  }
}

async function executableExists(path: string) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
