import { describe, expect, it } from "vitest";
import { TaskService } from "../src/application/task-service.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";

describe("local task completion", () => {
  it("completes without creating a CRM or tracker update", async () => {
    const opened = await openDatabase(":memory:");
    const repository = new TaskRepository(opened.db);
    const service = new TaskService(repository);
    const task = await service.capture({
      title: "Local delivery",
      source: "manual",
      assignmentDescription: "Complete inside AwenesOS",
      assignedToMe: false,
      occurredAt: new Date(),
    });
    await service.claim(task.id);
    await service.start(task.id);
    expect(await service.draftCompletion(task.id)).toContain("Local delivery");
    await service.prepareCompletion(task.id, "Implemented and tested");
    expect((await repository.get(task.id)).status).toBe("ready_to_complete");
    await service.editCompletion(task.id, "Reviewed implementation and tests");

    expect(await service.complete(task.id)).toMatchObject({
      status: "completed",
      completionDescription: "Reviewed implementation and tests",
    });
    expect((await service.history(task.id)).at(-1)?.type).toBe(
      "task.completed",
    );
    opened.client.close();
  });
});
