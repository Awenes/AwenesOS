import { isAbsolute, relative, resolve } from "node:path";
import type { ExecutionPolicy } from "../domain/project.js";

export class ExecutionGuard {
  constructor(
    private readonly worktreeRoot: string,
    private readonly policy: ExecutionPolicy,
  ) {}

  assertWritablePath(path: string): string {
    const root = resolve(this.worktreeRoot);
    const target = resolve(path);
    const offset = relative(root, target);
    if (offset === "" || (!offset.startsWith("..") && !isAbsolute(offset)))
      return target;
    throw new Error(`Write denied outside the task worktree: ${target}`);
  }

  assertCommand(command: string): void {
    const executable = command
      .replace(/\.cmd$/i, "")
      .split(/[\\/]/)
      .at(-1)
      ?.toLowerCase();
    const allowed = this.policy.commandAllowlist.map((item) =>
      item
        .replace(/\.cmd$/i, "")
        .split(/[\\/]/)
        .at(-1)
        ?.toLowerCase(),
    );
    if (!executable || !allowed.includes(executable))
      throw new Error(`Command is not allowed: ${command}`);
  }

  filterEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return Object.fromEntries(
      this.policy.environmentAllowlist.flatMap((key) =>
        environment[key] === undefined ? [] : [[key, environment[key]]],
      ),
    );
  }

  assertNetwork(requested: "none" | "localhost" | "public"): void {
    const level = { none: 0, localhost: 1, public: 2 } as const;
    if (level[requested] > level[this.policy.networkAccess])
      throw new Error(
        `Network access denied: requested ${requested}, allowed ${this.policy.networkAccess}`,
      );
  }

  assertPushApproved(approved: boolean): void {
    if (this.policy.requirePushApproval && !approved)
      throw new Error("Git push requires developer approval");
  }
}
