import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskService } from "../src/application/task-service.js";
import type { CrmTaskAdapter } from "../src/domain/crm.js";
import { MockCrmAdapter } from "../src/infrastructure/crm/mock-crm-adapter.js";
import { ManualCrmAdapter } from "../src/infrastructure/crm/manual-crm-adapter.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import type { GitEvidenceCollector, GitRepositoryInspector } from "../src/domain/git-evidence.js";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

async function setup(adapter?: CrmTaskAdapter) {
  const dir = await mkdtemp(join(tmpdir(), "awenes-")); dirs.push(dir);
  const opened = await openDatabase(":memory:");
  const repository = new TaskRepository(opened.db);
  return { service: new TaskService(repository, adapter ?? new MockCrmAdapter(join(dir, "crm.json"))), repository, client: opened.client };
}

describe("first vertical slice", () => {
  it("tracks work locally and requires explicit manual CRM completion confirmation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "awenes-manual-")); dirs.push(dir);
    const opened = await openDatabase(":memory:");
    const repository = new TaskRepository(opened.db);
    const service = new TaskService(repository, new ManualCrmAdapter(), "manual");
    const task = await service.capture({ title: "Manual CRM workflow", source: "manual", assignmentDescription: "Keep external status aligned", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id);
    await expect(service.mapToCrm(task.id, "CRM", undefined)).rejects.toThrow("existing CRM task ID");
    await service.mapToCrm(task.id, "CRM", "TASK-42", "https://crm.example.test/tasks/42");

    expect((await service.start(task.id)).status).toBe("in_progress");
    expect(await service.pendingManualCrmUpdates()).toEqual([expect.objectContaining({ taskId: task.id, desiredStatus: "In Progress", status: "pending" })]);
    expect((await service.pause(task.id)).status).toBe("paused");
    expect(await service.pendingManualCrmUpdates()).toEqual([expect.objectContaining({ desiredStatus: "Paused" })]);
    await service.confirmManualCrmUpdate(task.id);
    expect(await service.pendingManualCrmUpdates()).toHaveLength(0);

    await service.resume(task.id);
    await service.prepareCompletion(task.id, "Finished and verified the requested work.");
    expect((await service.complete(task.id)).status).toBe("sync_pending");
    expect(await service.pendingManualCrmUpdates()).toEqual([expect.objectContaining({ desiredStatus: "Completed", description: "Finished and verified the requested work." })]);
    const confirmed = await service.confirmManualCrmUpdate(task.id);
    expect(confirmed.task.status).toBe("completed");
    expect((await repository.history(task.id)).map((event) => event.type)).toEqual(expect.arrayContaining(["task.crm_manual_update_requested", "task.crm_manual_update_confirmed", "task.crm_sync_succeeded"]));
    await opened.client.close();
  });

  it("captures, claims, maps, executes, completes, and records history", async () => {
    const { service, repository, client } = await setup();
    const task = await service.capture({ title: "Fix guardian invite flow", source: "teams", assignmentDescription: "Prevent duplicate invites", assignedToMe: false, occurredAt: new Date() });
    expect(await service.inbox()).toHaveLength(1);
    await service.claim(task.id);
    await service.mapToCrm(task.id, "project-1");
    await service.start(task.id);
    await service.pause(task.id);
    await service.resume(task.id);
    await service.addEvidence(task.id, "test", "guardian invite tests passed");
    const description = await service.prepareCompletion(task.id);
    expect(description).toContain("guardian invite tests passed");
    await service.editCompletion(task.id, "Prevented duplicate invites and added regression coverage.");
    const completed = await service.complete(task.id);
    expect(completed.status).toBe("completed");
    expect((await repository.history(task.id)).map((event) => event.type)).toContain("task.crm_sync_succeeded");
    client.close();
  });

  it("keeps completion pending when external sync fails", async () => {
    const failingCrm: CrmTaskAdapter = {
      name: "failing",
      async createTask() { return { externalTaskId: "external-1" }; },
      async updateExecutionStatus() {},
      async completeTask() { throw new Error("CRM unavailable"); }
    };
    const { service, repository, client } = await setup(failingCrm);
    const task = await service.capture({ title: "Retry completion", source: "manual", assignmentDescription: "Test retry", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id);
    await service.mapToCrm(task.id, "project-1");
    await service.start(task.id);
    await service.prepareCompletion(task.id, "Finished the requested work.");
    await expect(service.complete(task.id)).rejects.toThrow("sync_pending");
    const pending = await repository.get(task.id);
    expect(pending.status).toBe("sync_pending");
    expect(pending.syncError).toBe("CRM unavailable");
    client.close();
  });

  it("requires explicit confirmation after a manual SharePoint tracker update", async () => {
    const { service, repository, client } = await setup();
    const task = await service.capture({ title: "Fix mobile filter", source: "bug-tracker", sourceReference: "sharepoint:agege:mobile:FEATURE-9", assignmentDescription: "Remove unused filter", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id);
    await service.mapToCrm(task.id, "project-1");
    await service.start(task.id);
    await service.prepareCompletion(task.id, "Removed the unused mobile filter and verified the screen.");
    expect((await service.complete(task.id)).status).toBe("completed");
    const pending = await service.pendingTrackerUpdates();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ taskId: task.id, status: "pending", suggestedStatus: "Completed", suggestedComment: "Removed the unused mobile filter and verified the screen." });
    expect(await service.standup()).toContain("manual SharePoint tracker update pending");
    await service.confirmTrackerUpdate(task.id);
    expect(await service.pendingTrackerUpdates()).toHaveLength(0);
    expect(await service.standup()).not.toContain("manual SharePoint tracker update pending");
    expect((await repository.history(task.id)).map((event) => event.type)).toEqual(expect.arrayContaining(["task.tracker_manual_update_requested", "task.tracker_manual_update_confirmed"]));
    client.close();
  });

  it("collects Git metadata since task start without duplicating evidence", async () => {
    const { service, repository, client } = await setup();
    const task = await service.capture({ title: "Add attendance validation", source: "manual", assignmentDescription: "Validate attendance input", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id); await service.mapToCrm(task.id, "project-1"); await service.start(task.id);
    const inspector: GitRepositoryInspector = { async inspect() { return { repository: "C:/work/app", branch: "feature/attendance", head: "start123" }; } };
    await service.attachRepository(task.id, ".", inspector);
    let observedSince: Date | undefined; let observedRepository: string | undefined;
    const collector: GitEvidenceCollector = { async collect(input) { observedSince = input.since; observedRepository = input.repositoryPath; return { repository: "C:/work/app", branch: "feature/attendance", commits: ["abc123\tAdd attendance validation"], files: ["src/attendance.ts", "tests/attendance.test.ts"] }; } };
    expect(await service.collectGitEvidence(task.id, undefined, collector)).toMatchObject({ commits: 1, files: 2, added: 3, skippedExisting: 0 });
    expect(observedSince).toBeInstanceOf(Date);
    expect(observedRepository).toBe("C:/work/app");
    expect(await service.collectGitEvidence(task.id, undefined, collector)).toMatchObject({ added: 0, skippedExisting: 3 });
    expect(await repository.evidenceFor(task.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "commit", value: "abc123\tAdd attendance validation" }),
      expect.objectContaining({ kind: "file", value: "C:/work/app: src/attendance.ts" })
    ]));
    client.close();
  });

  it("records repository remapping instead of silently changing task context", async () => {
    const { service, repository, client } = await setup();
    const task = await service.capture({ title: "Repository mapping", source: "manual", assignmentDescription: "Map repository", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id);
    const first: GitRepositoryInspector = { async inspect() { return { repository: "C:/work/one", branch: "main", head: "111" }; } };
    const second: GitRepositoryInspector = { async inspect() { return { repository: "C:/work/two", branch: "feature", head: "222" }; } };
    await service.attachRepository(task.id, ".", first);
    expect(await service.attachRepository(task.id, ".", second)).toMatchObject({ repositoryRoot: "C:/work/two", branchAtMapping: "feature", headAtMapping: "222" });
    expect((await repository.history(task.id)).map((event) => event.type)).toEqual(expect.arrayContaining(["task.repository_mapped", "task.repository_remapped"]));
    client.close();
  });

  it("builds a structured deterministic completion draft from reviewed evidence", async () => {
    const { service, client } = await setup();
    const task = await service.capture({ title: "Improve enrollment import", source: "bug-tracker", sourceReference: "AGEGE / General Tests / FEATURE-12", assignmentDescription: "Reject malformed student rows without stopping valid imports", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id); await service.mapToCrm(task.id, "project-1");
    await service.attachRepository(task.id, ".", { async inspect() { return { repository: "C:/work/skoolbod", branch: "feature/enrollment", head: "start" }; } });
    await service.start(task.id);
    await service.addEvidence(task.id, "commit", "abcdef123456\tHandle malformed enrollment rows");
    await service.addEvidence(task.id, "file", "C:/work/skoolbod: src/enrollment/import.ts");
    await service.addEvidence(task.id, "test", "Enrollment import regression suite passed");
    await service.addEvidence(task.id, "build", "Production build passed");
    await service.addEvidence(task.id, "link", "https://example.test/result/12");
    const draft = await service.draftCompletion(task.id);
    expect(draft).toContain("Completed:\n- Improve enrollment import");
    expect(draft).toContain("What changed:\n- Handle malformed enrollment rows (abcdef12)");
    expect(draft).toContain("Files changed:\n- src/enrollment/import.ts");
    expect(draft).toContain("Verification:\n- Test: Enrollment import regression suite passed\n- Build: Production build passed");
    expect(draft).toContain("Repository context:\n- C:/work/skoolbod (feature/enrollment)");
    expect(draft).toContain("Requested outcome:\n- Reject malformed student rows without stopping valid imports");
    expect(await service.prepareCompletion(task.id)).toBe(draft);
    client.close();
  });

  it("flags an evidence-free completion draft for review", async () => {
    const { service, client } = await setup();
    const task = await service.capture({ title: "Unverified work", source: "manual", assignmentDescription: "", assignedToMe: false, occurredAt: new Date() });
    await service.claim(task.id); await service.mapToCrm(task.id, "project-1"); await service.start(task.id);
    expect(await service.draftCompletion(task.id)).toContain("No completion evidence is recorded yet"); client.close();
  });
});
