import { NotificationDurationSchema, NotificationSnoozeSchema, type LocalNotification } from "../domain/notification.js";
import type { Task } from "../domain/task.js";
import { TaskRepository } from "../infrastructure/repositories/task-repository.js";
const HOUR = 60 * 60 * 1_000;
export class NotificationService {
  constructor(private readonly repository: TaskRepository) {}
  async list(now = new Date()): Promise<LocalNotification[]> {
    const candidates: LocalNotification[] = [];
    for (const task of await this.repository.list()) {
      if (task.status === "sync_pending" && task.syncError) candidates.push(item(task, "crm_sync_failed", "critical", "CRM completion needs attention", task.syncError, "Retry CRM completion sync"));
      if (task.status === "ready_to_complete") candidates.push(item(task, "completion_ready", "action", "Completion is ready for review", "The completion description is prepared but has not been synchronized.", "Review and complete the task"));
      if (task.status === "paused" && age(task, now) >= 4 * HOUR) candidates.push(item(task, "task_paused", "action", "Task has remained paused", `Paused for ${hours(age(task, now))} hour(s).`, "Resume it, complete it, or leave a note"));
      if (task.status === "in_progress" && age(task, now) >= 2 * HOUR && !(await this.repository.evidenceFor(task.id)).length) candidates.push(item(task, "evidence_missing", "info", "Active task has no evidence yet", `Active for ${hours(age(task, now))} hour(s) without recorded evidence.`, "Collect Git evidence or add a note"));
    }
    for (const update of await this.repository.pendingManualCrmUpdates()) candidates.push({ key: `crm_update_pending:${update.id}`, taskId: update.taskId, kind: "crm_update_pending", severity: update.desiredStatus === "Completed" ? "critical" : "action", title: "Manual CRM update pending", detail: `Set the CRM status to ${update.desiredStatus}${update.description ? " and apply the completion description" : ""}.`, suggestedAction: "Update the CRM and confirm it in Awenes", createdAt: update.createdAt });
    for (const update of await this.repository.pendingTrackerUpdates()) candidates.push({ key: `tracker_update_pending:${update.taskId}:${update.createdAt.getTime()}`, taskId: update.taskId, kind: "tracker_update_pending", severity: "action", title: "SharePoint tracker update pending", detail: `${update.reference} should be updated to ${update.suggestedStatus}.`, suggestedAction: "Update SharePoint and confirm it in Awenes", createdAt: update.createdAt });
    const preferences = new Map((await this.repository.notificationPreferences()).map((preference) => [preference.notificationKey, preference]));
    return candidates.filter((candidate) => { const preference = preferences.get(candidate.key); return !preference?.dismissedAt && !(preference?.snoozedUntil && preference.snoozedUntil > now); }).sort((left, right) => rank(right.severity) - rank(left.severity) || left.createdAt.getTime() - right.createdAt.getTime());
  }
  async dismiss(key: string, now = new Date()) { const found = (await this.list(now)).find((entry) => entry.key === key); if (!found) throw new Error(`Active notification not found: ${key}`); return this.repository.saveNotificationPreference({ notificationKey: key, taskId: found.taskId, dismissedAt: now, snoozedUntil: null, updatedAt: now }, "task.notification_dismissed"); }
  async snooze(key: string, untilInput: Date | string, now = new Date()) { const until = NotificationSnoozeSchema.parse({ until: untilInput }).until; if (until <= now) throw new Error("Snooze time must be in the future"); const found = (await this.list(now)).find((entry) => entry.key === key); if (!found) throw new Error(`Active notification not found: ${key}`); return this.repository.saveNotificationPreference({ notificationKey: key, taskId: found.taskId, dismissedAt: null, snoozedUntil: until, updatedAt: now }, "task.notification_snoozed"); }
  async snoozeFor(key: string, durationInput = "1h", now = new Date()) { return this.snooze(key, new Date(now.getTime() + durationMilliseconds(NotificationDurationSchema.parse(durationInput))), now); }
}
function item(task: Task, kind: LocalNotification["kind"], severity: LocalNotification["severity"], title: string, detail: string, suggestedAction: string): LocalNotification { return { key: `${kind}:${task.id}:${task.updatedAt.getTime()}`, taskId: task.id, kind, severity, title, detail: `${task.title} — ${detail}`, suggestedAction, createdAt: task.updatedAt }; }
function age(task: Task, now: Date) { return Math.max(0, now.getTime() - task.updatedAt.getTime()); }
function hours(value: number) { return Math.floor(value / HOUR); }
function rank(value: LocalNotification["severity"]) { return value === "critical" ? 3 : value === "action" ? 2 : 1; }
function durationMilliseconds(value: string) { const amount = Number.parseInt(value, 10); const unit = value.at(-1); return amount * (unit === "m" ? 60_000 : unit === "h" ? HOUR : 24 * HOUR); }
