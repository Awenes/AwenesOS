import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProjectService } from "../src/application/project-service.js";
import type { EnvironmentInspector } from "../src/domain/project.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("project service", () => {
  it("registers multiple projects and records policy changes as events", async () => {
    const directory = await mkdtemp(join(tmpdir(), "awenes-projects-")); dirs.push(directory);
    const opened = await openDatabase(":memory:");
    const repository = new ProjectRepository(opened.db);
    const inspector: EnvironmentInspector = { inspect: async (project) => ({ projectId: project.id, ready: true, checkedAt: new Date(), checks: [] }) };
    const service = new ProjectService(repository, inspector);

    const first = await service.register({ name: "API", repositoryRoot: join(directory, "api"), defaultBranch: "main", completionPolicy: "manual" });
    const second = await service.register({ name: "Web", repositoryRoot: join(directory, "web"), defaultBranch: "develop", completionPolicy: "approve_push" });
    await service.setCompletionPolicy(first.id, "auto_push");

    expect((await service.list()).map((project) => project.name)).toEqual(["API", "Web"]);
    expect((await repository.history(first.id)).map((event) => event.type)).toEqual(["project.registered", "project.completion_policy_changed"]);
    expect((await service.readiness(second.id)).ready).toBe(true);
    await opened.client.close();
  });

  it("rejects registering the same repository twice", async () => {
    const opened = await openDatabase(":memory:");
    const service = new ProjectService(new ProjectRepository(opened.db), { inspect: async (project) => ({ projectId: project.id, ready: true, checkedAt: new Date(), checks: [] }) });
    const input = { name: "One", repositoryRoot: ".", defaultBranch: "main", completionPolicy: "manual" as const };
    await service.register(input);
    await expect(service.register({ ...input, name: "Two" })).rejects.toThrow();
    await opened.client.close();
  });

  it("initializes a non-Git folder only after explicit confirmation", async () => {
    const opened = await openDatabase(":memory:");
    const calls: string[] = [];
    const git = {
      isRepository: async () => false,
      initialize: async (root: string, branch: string) => { calls.push(`${root}:${branch}`); },
    };
    const service = new ProjectService(new ProjectRepository(opened.db), { inspect: async (project) => ({ projectId: project.id, ready: true, checkedAt: new Date(), checks: [] }) }, git);
    const input = { name: "New app", repositoryRoot: ".", defaultBranch: "main", completionPolicy: "manual" as const };
    await expect(service.register(input)).rejects.toThrow("not a Git repository");
    await service.register({ ...input, initializeGit: true });
    expect(calls).toHaveLength(1);
    await opened.client.close();
  });
});
