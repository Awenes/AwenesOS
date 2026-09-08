import { describe, expect, it } from "vitest";
import { calculateTaskDuration, formatDuration } from "../src/domain/task-duration.js";

describe("task duration", () => {
  it("separates active work from paused and calendar time", () => {
    const result = calculateTaskDuration([
      { type: "task.started", occurredAt: new Date("2026-09-03T09:00:00Z") },
      { type: "task.paused", occurredAt: new Date("2026-09-03T10:00:00Z") },
      { type: "task.resumed", occurredAt: new Date("2026-09-03T10:30:00Z") },
      { type: "task.completion_prepared", occurredAt: new Date("2026-09-03T12:00:00Z") }
    ]);
    expect(result).toMatchObject({ activeMilliseconds: 9_000_000, pausedMilliseconds: 1_800_000, calendarMilliseconds: 10_800_000, sessions: 2, running: false });
    expect(formatDuration(result.activeMilliseconds)).toBe("2h 30m");
  });
});
