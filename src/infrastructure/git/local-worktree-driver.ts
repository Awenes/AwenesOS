import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitWorktreeDriver } from "../../application/worktree-service.js";

const execute = promisify(execFile);

export class LocalWorktreeDriver implements GitWorktreeDriver {
  async create(repositoryRoot: string, path: string, branch: string, baseBranch: string): Promise<void> {
    await execute("git", ["-C", repositoryRoot, "worktree", "add", "-b", branch, path, baseBranch], { timeout: 30_000, windowsHide: true });
  }
  async remove(repositoryRoot: string, path: string): Promise<void> {
    await execute("git", ["-C", repositoryRoot, "worktree", "remove", path], { timeout: 30_000, windowsHide: true });
  }
}
