import { describe, expect, it } from "vitest";
import { ReportingService } from "../src/application/reporting-service.js";
import { ReportDateSchema, configuredWorkingDays } from "../src/domain/reporting.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";

describe("reporting", () => {
  it("uses the previous configured working day for a Monday standup", async () => {
    const opened = await openDatabase(":memory:"); const repository = new TaskRepository(opened.db);
    const completed = await repository.create({ title: "Friday delivery", source: "manual", assignmentDescription: "", assignedToMe: false, occurredAt: new Date("2026-09-04T09:00:00") });
    await repository.setCompletion(completed.id, "Delivered Friday work"); await repository.markCompleted(completed.id, new Date("2026-09-04T16:00:00"));
    const active = await repository.create({ title: "Monday priority", source: "manual", assignmentDescription: "", assignedToMe: false, occurredAt: new Date("2026-09-07T08:00:00") }); await repository.transition(active.id, "captured", "planned", "task.claimed");
    const report = await new ReportingService(repository, [1, 2, 3, 4, 5]).standup(new Date("2026-09-07T10:00:00"));
    expect(report).toContain("# Standup — 2026-09-07"); expect(report).toContain("- Delivered Friday work"); expect(report).toContain("- Monday priority"); await opened.client.close();
  });

  it("builds a five-working-day weekly review with counts and evidence", async () => {
    const opened = await openDatabase(":memory:"); const repository = new TaskRepository(opened.db);
    const task = await repository.create({ title: "Weekly delivery", source: "manual", assignmentDescription: "", assignedToMe: false, occurredAt: new Date("2026-09-01T09:00:00") }); await repository.addEvidence(task.id, "test", "Suite passed"); await repository.setCompletion(task.id, "Completed weekly delivery"); await repository.markCompleted(task.id, new Date("2026-09-03T14:00:00"));
    const report = await new ReportingService(repository).weeklyReview(new Date("2026-09-04T12:00:00"));
    expect(report).toContain("# Weekly review — 2026-08-31 to 2026-09-04"); expect(report).toContain("Completed: 1"); expect(report).toContain("Evidence items: 1"); expect(report).toContain("Completed weekly delivery"); await opened.client.close();
  });

  it("accepts friendly report dates and validates working-day configuration", () => {
    expect(ReportDateSchema.parse("2026-09-03").getDate()).toBe(3); expect(ReportDateSchema.parse("today")).toBeInstanceOf(Date);
    expect(configuredWorkingDays("1,2,3,4,5")).toEqual([1, 2, 3, 4, 5]); expect(() => configuredWorkingDays("8")).toThrow();
  });
});
