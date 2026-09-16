import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  EnvironmentInspector,
  ExecutionPolicy,
  Project,
  ReadinessCheck,
  ReadinessReport,
} from "../../domain/project.js";

const execute = promisify(execFile);

export class LocalEnvironmentInspector implements EnvironmentInspector {
  async inspect(project: Project, policy: ExecutionPolicy): Promise<ReadinessReport> {
    const checks: ReadinessCheck[] = [];
    checks.push(await directoryCheck(project.repositoryRoot));
    checks.push(await commandCheck("git", ["--version"], true));
    for (const command of policy.commandAllowlist)
      if (command.trim().toLowerCase() !== "git")
        checks.push(await commandCheck(command, ["--version"], true));
    checks.push(await repositoryCheck(project.repositoryRoot));
    checks.push(await browserCheck());
    return {
      projectId: project.id,
      ready: checks
        .filter((check) => check.required)
        .every((check) => check.ready),
      checkedAt: new Date(),
      checks,
    };
  }
}

async function browserCheck(): Promise<ReadinessCheck> {
  const candidates =
    process.platform === "win32"
      ? [
          `${process.env.PROGRAMFILES ?? "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)"}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "/usr/bin/microsoft-edge",
        ];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return {
        name: "browser",
        ready: true,
        required: false,
        detail: `Isolated localhost testing available with ${candidate}`,
      };
    } catch {
      /* try the next supported browser */
    }
  }
  return {
    name: "browser",
    ready: false,
    required: false,
    detail:
      "Chrome or Edge was not found. Browser verification will be unavailable until one is installed.",
  };
}

async function directoryCheck(root: string): Promise<ReadinessCheck> {
  try {
    await access(root, constants.R_OK | constants.W_OK);
    return {
      name: "repository",
      ready: true,
      required: true,
      detail: `Readable and writable: ${root}`,
    };
  } catch {
    return {
      name: "repository",
      ready: false,
      required: true,
      detail: `Repository path is not readable and writable: ${root}`,
    };
  }
}

async function repositoryCheck(root: string): Promise<ReadinessCheck> {
  try {
    await execute("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
      timeout: 5000,
      windowsHide: true,
    });
    await execute("git", ["-C", root, "worktree", "list", "--porcelain"], {
      timeout: 5000,
      windowsHide: true,
    });
    return {
      name: "worktree",
      ready: true,
      required: true,
      detail: "Git repository supports dedicated worktrees",
    };
  } catch (error) {
    return {
      name: "worktree",
      ready: false,
      required: true,
      detail: message(error),
    };
  }
}

async function commandCheck(
  command: string,
  args: string[],
  required: boolean,
): Promise<ReadinessCheck> {
  const bareName = !/[\\/.]/.test(command);
  const candidates = process.platform === "win32" && bareName ? [command, `${command}.cmd`, `${command}.exe`] : [command];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const { stdout, stderr } = await execute(candidate, args, {
        timeout: 5000,
        windowsHide: true,
      });
      return { name: command, ready: true, required, detail: (stdout || stderr).trim() };
    } catch (error) {
      lastError = error;
    }
  }
  return { name: command, ready: false, required, detail: message(lastError) };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
