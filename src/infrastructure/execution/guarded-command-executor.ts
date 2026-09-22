import { spawn, execFile } from "node:child_process";
import { accessSync } from "node:fs";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import {
  ExecutionRequestSchema,
  type ExecutionRequest,
  type ExecutionResult,
  type ManagedCommandExecutor,
} from "../../domain/execution.js";
import type { ExecutionPolicy } from "../../domain/project.js";
import { ExecutionGuard } from "../../application/execution-guard.js";
const exec = promisify(execFile);
const MAX_OUTPUT = 2_000_000;
// Resolves a bare command name against PATH only, never the working
// directory. Windows's own process creation searches the working directory
// before PATH, which would let a task worktree the agent can write to plant
// a same-named executable (e.g. "git.exe") that then runs in place of the
// real, allowlisted binary. Passing spawn() an already-resolved absolute
// path avoids that implicit search entirely. Commands given as an explicit
// path are left untouched — they're not subject to the PATH/cwd ambiguity.
function resolveExecutable(command: string): string {
  if (/[\\/]/.test(command)) return command;
  const pathVar = process.env.PATH ?? process.env.Path ?? "";
  const extensions =
    process.platform === "win32" && !/\.[^.\\/]+$/.test(command)
      ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
      : [""];
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = join(dir, `${command}${extension}`);
      try {
        accessSync(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
  }
  throw new Error(`Command not found on PATH: ${command}`);
}
export class GuardedCommandExecutor implements ManagedCommandExecutor {
  private guard: ExecutionGuard;
  constructor(
    private root: string,
    private policy: ExecutionPolicy,
  ) {
    this.guard = new ExecutionGuard(root, policy);
  }
  async start(raw: ExecutionRequest) {
    const input = ExecutionRequestSchema.parse(raw);
    this.guard.assertCommand(input.command);
    const cwd = this.guard.assertWritablePath(input.cwd);
    this.guard.assertNetwork(input.network);
    const child = spawn(resolveExecutable(input.command), input.args, {
      cwd,
      env: this.environment(input.network),
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: "ignore",
    });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    return { pid: child.pid!, stop: () => terminateTree(child.pid) };
  }
  async execute(raw: ExecutionRequest): Promise<ExecutionResult> {
    const input = ExecutionRequestSchema.parse(raw);
    this.guard.assertCommand(input.command);
    const cwd = this.guard.assertWritablePath(input.cwd);
    this.guard.assertNetwork(input.network);
    const startedAt = new Date();
    const executable = resolveExecutable(input.command);
    return new Promise((resolve, reject) => {
      const child = spawn(executable, input.args, {
        cwd,
        env: this.environment(input.network),
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: "pipe",
      });
      let stdout = "",
        stderr = "",
        timedOut = false,
        settled = false;
      let graceTimer: NodeJS.Timeout | undefined;
      const settle = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(graceTimer);
        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          startedAt,
          completedAt: new Date(),
        });
      };
      const append = (current: string, value: Buffer) =>
        `${current}${value.toString()}`.slice(-MAX_OUTPUT);
      child.stdout.on("data", (value) => (stdout = append(stdout, value)));
      child.stderr.on("data", (value) => (stderr = append(stderr, value)));
      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          clearTimeout(graceTimer);
          reject(error);
        }
      });
      child.on("close", (code) => settle(code));
      if (input.stdin) child.stdin.write(input.stdin);
      child.stdin.end();
      const timeoutSeconds = Math.min(
        input.timeoutSeconds ?? this.policy.processTimeoutSeconds,
        this.policy.processTimeoutSeconds,
      );
      const timer = setTimeout(() => {
        timedOut = true;
        void terminateTree(child.pid);
        graceTimer = setTimeout(() => settle(null), 5_000);
      }, timeoutSeconds * 1000);
    });
  }
  private environment(network: ExecutionRequest["network"]) {
    const filtered = this.guard.filterEnvironment(process.env);
    for (const key of [
      "PATH",
      "Path",
      "PATHEXT",
      "SYSTEMROOT",
      "SystemRoot",
      "WINDIR",
      "TEMP",
      "TMP",
    ]) {
      if (process.env[key] !== undefined) filtered[key] = process.env[key];
    }
    if (network !== "public") {
      filtered.HTTP_PROXY = "http://127.0.0.1:9";
      filtered.HTTPS_PROXY = "http://127.0.0.1:9";
      filtered.ALL_PROXY = "http://127.0.0.1:9";
      filtered.NO_PROXY =
        network === "localhost" ? "localhost,127.0.0.1,::1" : "";
    }
    return filtered;
  }
}
async function terminateTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") {
    try {
      await exec("taskkill", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
      });
    } catch {
      return;
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      return;
    }
  }
}
