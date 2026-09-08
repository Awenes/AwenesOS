export interface TimedTaskEvent { type: string; occurredAt: Date; }
export interface TaskDuration { activeMilliseconds: number; pausedMilliseconds: number; calendarMilliseconds: number; sessions: number; running: boolean; firstStartedAt: Date | null; lastActivityAt: Date | null; }

export function calculateTaskDuration(events: TimedTaskEvent[], now = new Date()): TaskDuration {
  const ordered = [...events].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  let activeStart: Date | null = null; let pausedStart: Date | null = null; let activeMilliseconds = 0; let pausedMilliseconds = 0; let sessions = 0; let firstStartedAt: Date | null = null; let lastActivityAt: Date | null = null;
  for (const event of ordered) {
    if (!["task.started", "task.resumed", "task.paused", "task.completion_prepared", "task.crm_sync_succeeded"].includes(event.type)) continue;
    lastActivityAt = event.occurredAt;
    if (event.type === "task.started" || event.type === "task.resumed") {
      if (pausedStart) { pausedMilliseconds += elapsed(pausedStart, event.occurredAt); pausedStart = null; }
      if (!activeStart) { activeStart = event.occurredAt; sessions += 1; firstStartedAt ??= event.occurredAt; }
    }
    if (event.type === "task.paused" && activeStart) { activeMilliseconds += elapsed(activeStart, event.occurredAt); activeStart = null; pausedStart = event.occurredAt; }
    if ((event.type === "task.completion_prepared" || event.type === "task.crm_sync_succeeded")) {
      if (activeStart) { activeMilliseconds += elapsed(activeStart, event.occurredAt); activeStart = null; }
      if (pausedStart) { pausedMilliseconds += elapsed(pausedStart, event.occurredAt); pausedStart = null; }
    }
  }
  if (activeStart) activeMilliseconds += elapsed(activeStart, now);
  if (pausedStart) pausedMilliseconds += elapsed(pausedStart, now);
  return { activeMilliseconds, pausedMilliseconds, calendarMilliseconds: firstStartedAt ? elapsed(firstStartedAt, lastActivityAt && !activeStart && !pausedStart ? lastActivityAt : now) : 0, sessions, running: Boolean(activeStart), firstStartedAt, lastActivityAt };
}
function elapsed(from: Date, to: Date) { return Math.max(0, to.getTime() - from.getTime()); }
export function formatDuration(milliseconds: number) { const minutes = Math.floor(milliseconds / 60_000); const hours = Math.floor(minutes / 60); return `${hours ? `${hours}h ` : ""}${minutes % 60}m`; }
