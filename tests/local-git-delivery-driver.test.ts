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

  it("throws instead of silently succeeding when there is nothing to commit", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-git-delivery-"));
    dirs.push(root);
    await exec("git", ["init", "-b", "main"], { cwd: root });
    await exec("git", ["config", "user.email", "test@awenes.local"], { cwd: root });
    await exec("git", ["config", "user.name", "Awenes Test"], { cwd: root });
    await writeFile(join(root, "file.txt"), "content");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "initial"], { cwd: root });
    const driver = new LocalGitDeliveryDriver();
    await expect(driver.commit(root, "feat: nothing changed")).rejects.toThrow();
  }, 20_000);

  it("throws when a push is rejected because the remote branch has diverged", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-git-delivery-")),
      other = await mkdtemp(join(tmpdir(), "awenes-git-delivery-other-")),
      remote = await mkdtemp(join(tmpdir(), "awenes-git-remote-"));
    dirs.push(root, other, remote);
    await exec("git", ["init", "--bare", remote]);
    await exec("git", ["init", "-b", "main"], { cwd: root });
    await exec("git", ["config", "user.email", "test@awenes.local"], { cwd: root });
    await exec("git", ["config", "user.name", "Awenes Test"], { cwd: root });
    await writeFile(join(root, "file.txt"), "before");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "initial"], { cwd: root });
    await exec("git", ["remote", "add", "origin", remote], { cwd: root });
    await exec("git", ["push", "origin", "main"], { cwd: root });
    // A second clone pushes first, so the driver's push below is out of date.
    await rm(other, { recursive: true, force: true });
    await exec("git", ["clone", remote, other]);
    await exec("git", ["config", "user.email", "test@awenes.local"], { cwd: other });
    await exec("git", ["config", "user.name", "Awenes Test"], { cwd: other });
    // The bare remote's HEAD symref doesn't necessarily point at "main", so
    // the clone's default branch name can't be relied on; check it out explicitly.
    await exec("git", ["checkout", "-B", "main", "origin/main"], { cwd: other });
    await writeFile(join(other, "other.txt"), "from elsewhere");
    await exec("git", ["add", "."], { cwd: other });
    await exec("git", ["commit", "-m", "from elsewhere"], { cwd: other });
    await exec("git", ["push", "origin", "main"], { cwd: other });
    await writeFile(join(root, "file.txt"), "after");
    const driver = new LocalGitDeliveryDriver();
    await driver.commit(root, "feat: local change");
    await expect(driver.push(root, "origin", "main")).rejects.toThrow();
  }, 30_000);
});
