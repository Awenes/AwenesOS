import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import type { GitRepositoryInitializer } from "../../domain/project.js";

const execute = promisify(execFile);

export class LocalGitRepositoryInitializer implements GitRepositoryInitializer {
  async isRepository(root: string) {
    try {
      const { stdout } = await execute(
        "git",
        ["-C", root, "rev-parse", "--show-toplevel"],
        { timeout: 5_000, windowsHide: true },
      );
      const [detectedRoot, requestedRoot] = await Promise.all([
        realpath(stdout.trim()),
        realpath(root),
      ]);
      return detectedRoot.toLocaleLowerCase() === requestedRoot.toLocaleLowerCase();
    } catch {
      return false;
    }
  }

  async initialize(root: string, defaultBranch: string) {
    await execute("git", ["-C", root, "init", "-b", defaultBranch], {
      timeout: 15_000,
      windowsHide: true,
    });
    await execute(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=AwenesOS",
        "-c",
        "user.email=local@awenes.invalid",
        "commit",
        "--allow-empty",
        "-m",
        "chore: initialize repository",
      ],
      { timeout: 15_000, windowsHide: true },
    );
  }
}
