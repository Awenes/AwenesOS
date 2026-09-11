import { spawn, execFile } from "node:child_process";
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
    const child = spawn(input.command, input.args, {
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
    return new Promise((resolve, reject) => {
      const child = spawn(input.command, input.args, {
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
      const append = (current: string, value: Buffer) =>
        `${current}${value.toString()}`.slice(-MAX_OUTPUT);
      child.stdout.on("data", (value) => (stdout = append(stdout, value)));
      child.stderr.on("data", (value) => (stderr = append(stderr, value)));
      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });
      child.on("close", (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            exitCode: code,
            stdout,
            stderr,
            timedOut,
            startedAt,
            completedAt: new Date(),
          });
        }
      });
      if (input.stdin) child.stdin.write(input.stdin);
      child.stdin.end();
      const timeoutSeconds = Math.min(
        input.timeoutSeconds ?? this.policy.processTimeoutSeconds,
        this.policy.processTimeoutSeconds,
      );
      const timer = setTimeout(async () => {
        timedOut = true;
        await terminateTree(child.pid);
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
