import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitRepositoryInitializer } from "../../domain/project.js";

const execute = promisify(execFile);

export class LocalGitRepositoryInitializer implements GitRepositoryInitializer {
  async isRepository(root: string) {
    try {
      await execute("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], { timeout: 5_000, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  async initialize(root: string, defaultBranch: string) {
    await execute("git", ["-C", root, "init", "-b", defaultBranch], { timeout: 15_000, windowsHide: true });
  }
}
