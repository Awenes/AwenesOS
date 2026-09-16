import { describe, expect, it } from "vitest";
import { TaskService } from "../src/application/task-service.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";

describe("local task service", () => {
  it("captures, plans, pauses, reviews, and completes locally without external updates", async () => {
    const opened = await openDatabase(":memory:");
    try {
      const repository = new TaskRepository(opened.db);
      const service = new TaskService(repository);
      const task = await service.capture({ title: "Fix onboarding", source: "manual", assignmentDescription: "Check the form", assignedToMe: true, occurredAt: new Date() });
      await service.claim(task.id);
      await service.start(task.id);
      await service.pause(task.id);
      await service.resume(task.id);
      await service.addEvidence(task.id, "test", "Onboarding checks passed");
      expect(await service.draftCompletion(task.id)).toContain("Onboarding checks passed");
      await service.prepareCompletion(task.id, "Implemented and checked the form");
      expect((await service.complete(task.id)).status).toBe("completed");
      expect((await service.history(task.id)).at(-1)?.type).toBe("task.completed");
    } finally { opened.client.close(); }
  });
});
