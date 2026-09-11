import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalGitDeliveryDriver } from "../src/infrastructure/git/local-git-delivery-driver.js";
const exec = promisify(execFile),
  dirs: string[] = [];
afterEach(async () =>
  Promise.all(
    dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  ),
);
describe("LocalGitDeliveryDriver", () => {
  it("reviews, commits, and pushes the exact worktree branch", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-git-delivery-")),
      remote = await mkdtemp(join(tmpdir(), "awenes-git-remote-"));
    dirs.push(root, remote);
    await exec("git", ["init", "--bare", remote]);
    await exec("git", ["init", "-b", "main"], { cwd: root });
    await exec("git", ["config", "user.email", "test@awenes.local"], {
      cwd: root,
    });
    await exec("git", ["config", "user.name", "Awenes Test"], { cwd: root });
    await writeFile(join(root, "file.txt"), "before");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "initial"], { cwd: root });
    await exec("git", ["remote", "add", "origin", remote], { cwd: root });
    await exec("git", ["switch", "-c", "awenes/test"], { cwd: root });
    await writeFile(join(root, "file.txt"), "after");
    const driver = new LocalGitDeliveryDriver();
    const review = await driver.review(root);
    expect(review).toMatchObject({
      branch: "awenes/test",
      status: " M file.txt",
    });
    expect(review.diff).toContain("+after");
    const sha = await driver.commit(root, "feat: update");
    expect(sha).toHaveLength(40);
    await driver.push(root, "origin", "awenes/test");
    const branches = (await exec("git", ["branch", "--list"], { cwd: remote }))
      .stdout;
    expect(branches).toContain("awenes/test");
  }, 20_000);
});
