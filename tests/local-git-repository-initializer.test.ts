import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalGitRepositoryInitializer } from "../src/infrastructure/git/local-git-repository-initializer.js";

const execute = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("LocalGitRepositoryInitializer", () => {
  it("creates a usable initial branch for worktrees", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-git-init-"));
    directories.push(root);
    const initializer = new LocalGitRepositoryInitializer();

    await initializer.initialize(root, "main");

    expect(await initializer.isRepository(root)).toBe(true);
    const { stdout: branch } = await execute("git", [
      "-C",
      root,
      "branch",
      "--show-current",
    ]);
    const { stdout: head } = await execute("git", [
      "-C",
      root,
      "rev-parse",
      "HEAD",
    ]);
    expect(branch.trim()).toBe("main");
    expect(head.trim()).toMatch(/^[a-f0-9]{40}$/);
  });
});
