import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalWorktreeDriver } from "../src/infrastructure/git/local-worktree-driver.js";
const exec = promisify(execFile),
  dirs: string[] = [];
afterEach(async () =>
  Promise.all(
    dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  ),
);
async function initRepo() {
  const root = await mkdtemp(join(tmpdir(), "awenes-worktree-repo-"));
  dirs.push(root);
  await exec("git", ["init", "-b", "main"], { cwd: root });
  await exec("git", ["config", "user.email", "test@awenes.local"], { cwd: root });
  await exec("git", ["config", "user.name", "Awenes Test"], { cwd: root });
  await writeFile(join(root, "file.txt"), "initial");
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "initial"], { cwd: root });
  return root;
}
describe("LocalWorktreeDriver", () => {
  it("is idempotent when a prior create left the worktree behind but the DB write never happened", async () => {
    const root = await initRepo();
    const worktreePath = join(root, "..", "awenes-worktree-retry");
    dirs.push(worktreePath);
    const driver = new LocalWorktreeDriver();
    await driver.create(root, worktreePath, "awenes/task-1", "main");
    await expect(
      driver.create(root, worktreePath, "awenes/task-1", "main"),
    ).resolves.toBeUndefined();
  }, 20_000);
  it("reuses an existing branch instead of failing when the path was removed but the branch remains", async () => {
    const root = await initRepo();
    const worktreePath = join(root, "..", "awenes-worktree-reuse");
    dirs.push(worktreePath);
    const driver = new LocalWorktreeDriver();
    await driver.create(root, worktreePath, "awenes/task-2", "main");
    await exec("git", ["worktree", "remove", "--force", worktreePath], {
      cwd: root,
    });
    await expect(
      driver.create(root, worktreePath, "awenes/task-2", "main"),
    ).resolves.toBeUndefined();
  }, 20_000);
  it("removes a clean worktree but still refuses to remove one with uncommitted changes", async () => {
    const root = await initRepo();
    const cleanPath = join(root, "..", "awenes-worktree-clean");
    const dirtyPath = join(root, "..", "awenes-worktree-dirty");
    dirs.push(cleanPath, dirtyPath);
    const driver = new LocalWorktreeDriver();
    await driver.create(root, cleanPath, "awenes/task-3", "main");
    await expect(driver.remove(root, cleanPath)).resolves.toBeUndefined();
    await driver.create(root, dirtyPath, "awenes/task-4", "main");
    await writeFile(join(dirtyPath, "file.txt"), "uncommitted change");
    await expect(driver.remove(root, dirtyPath)).rejects.toThrow();
  }, 20_000);
});
