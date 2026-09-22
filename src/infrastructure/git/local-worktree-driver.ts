import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { GitWorktreeDriver } from "../../application/worktree-service.js";

const execute = promisify(execFile);

export class LocalWorktreeDriver implements GitWorktreeDriver {
  async create(repositoryRoot: string, path: string, branch: string, baseBranch: string): Promise<void> {
    const canonicalPath = await realpath(path).catch(() => null);
    if (canonicalPath && (await this.worktreePaths(repositoryRoot)).has(canonicalPath))
      return;
    const args = (await this.branchExists(repositoryRoot, branch))
      ? ["-C", repositoryRoot, "worktree", "add", path, branch]
      : ["-C", repositoryRoot, "worktree", "add", "-b", branch, path, baseBranch];
    await execute("git", args, { timeout: 30_000, windowsHide: true });
  }
  async remove(repositoryRoot: string, path: string): Promise<void> {
    await execute("git", ["-C", repositoryRoot, "worktree", "remove", path], { timeout: 30_000, windowsHide: true });
  }
  private async worktreePaths(repositoryRoot: string): Promise<Set<string>> {
    const { stdout } = await execute(
      "git",
      ["-C", repositoryRoot, "worktree", "list", "--porcelain"],
      { timeout: 30_000, windowsHide: true },
    );
    const paths = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.startsWith("worktree ")) continue;
      const canonical = await realpath(
        line.slice("worktree ".length).trim(),
      ).catch(() => resolve(line.slice("worktree ".length).trim()));
      paths.add(canonical);
    }
    return paths;
  }
  private async branchExists(repositoryRoot: string, branch: string): Promise<boolean> {
    try {
      await execute(
        "git",
        ["-C", repositoryRoot, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        { timeout: 30_000, windowsHide: true },
      );
      return true;
    } catch {
      return false;
    }
  }
}
