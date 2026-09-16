import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalEnvironmentInspector } from "../src/infrastructure/environment/local-environment-inspector.js";
import { LocalGitRepositoryInitializer } from "../src/infrastructure/git/local-git-repository-initializer.js";
import { ExecutionPolicySchema, type Project } from "../src/domain/project.js";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), "awenes-readiness-"));
  dirs.push(dir);
  await new LocalGitRepositoryInitializer().initialize(dir, "main");
  return dir;
}

function project(repositoryRoot: string): Project {
  return {
    id: "project-1",
    name: "Sample",
    repositoryRoot,
    defaultBranch: "main",
    completionPolicy: "manual",
    autonomyMode: "balanced",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("LocalEnvironmentInspector", () => {
  // Each case spawns several real child processes (git, node, worktree
  // checks); under heavy concurrent system load that can outrun vitest's
  // 5s default, so these get a more generous budget.
  it("checks only git plus whatever the project's own allowlist declares", async () => {
    const report = await new LocalEnvironmentInspector().inspect(
      project(await repo()),
      ExecutionPolicySchema.parse({ commandAllowlist: [] }),
    );
    expect(report.checks.map((check) => check.name)).toEqual(["repository", "git", "worktree", "browser"]);
  }, 20_000);

  it("checks every allowlisted command without checking git twice", async () => {
    const report = await new LocalEnvironmentInspector().inspect(
      project(await repo()),
      ExecutionPolicySchema.parse({ commandAllowlist: ["Git", "node", "definitely-not-a-real-command-xyz"] }),
    );
    const names = report.checks.map((check) => check.name);
    expect(names.filter((name) => name.toLowerCase() === "git")).toHaveLength(1);
    expect(report.checks.find((check) => check.name === "node")).toMatchObject({ ready: true, required: true });
    expect(names).toContain("definitely-not-a-real-command-xyz");
  }, 20_000);

  it("fails readiness when a required allowlisted command is unavailable", async () => {
    const report = await new LocalEnvironmentInspector().inspect(
      project(await repo()),
      ExecutionPolicySchema.parse({ commandAllowlist: ["definitely-not-a-real-command-xyz"] }),
    );
    expect(report.checks.find((check) => check.name === "definitely-not-a-real-command-xyz")).toMatchObject({
      ready: false,
      required: true,
    });
    expect(report.ready).toBe(false);
  }, 20_000);

  it("no longer requires pnpm for a project that removed it from the allowlist", async () => {
    const report = await new LocalEnvironmentInspector().inspect(
      project(await repo()),
      ExecutionPolicySchema.parse({ commandAllowlist: ["git", "node"] }),
    );
    expect(report.checks.some((check) => check.name === "pnpm")).toBe(false);
  }, 20_000);
});
