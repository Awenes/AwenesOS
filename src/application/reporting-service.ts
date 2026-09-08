import { configuredWorkingDays, WorkingDaysSchema } from "../domain/reporting.js";
import type { Task } from "../domain/task.js";
import { TaskRepository } from "../infrastructure/repositories/task-repository.js";

export class ReportingService {
  private readonly workingDays: number[];
  constructor(private readonly repository: TaskRepository, workingDays = configuredWorkingDays()) { this.workingDays = WorkingDaysSchema.parse(workingDays); }

  async standup(date = new Date()): Promise<string> {
    const today = startOfDay(date); const previous = previousWorkingDay(today, this.workingDays);
    const completed = await this.repository.completedBetween(previous, today); const active = await this.activeTasks(); const blockers = await this.blockers();
    return [`# Standup — ${formatDate(today)}`, section("Yesterday", completed.map(summary)), section("Today", active.map((task) => task.title)), section("Blockers", blockers)].join("\n\n");
  }

  async weeklyReview(ending = new Date()): Promise<string> {
    const endDay = startOfDay(ending); const to = addDays(endDay, 1); const from = beginningOfWorkingWindow(endDay, this.workingDays, 5);
    const completed = await this.repository.completedBetween(from, to); const active = await this.activeTasks(); const blockers = await this.blockers();
    const evidenceCount = await this.evidenceCount(completed);
    return [`# Weekly review — ${formatDate(from)} to ${formatDate(endDay)}`, `Completed: ${completed.length}\nActive: ${active.length}\nEvidence items: ${evidenceCount}`, section("Completed work", completed.map(summary)), section("Carried forward", active.map((task) => `${task.title} [${task.status}]`)), section("Blockers", blockers)].join("\n\n");
  }

  private activeTasks() { return this.repository.list(["planned", "in_progress", "paused", "ready_to_complete", "sync_pending"]); }
  private async blockers() { const active = await this.activeTasks(); const tracker = await this.repository.pendingTrackerUpdates(); return [...active.filter((task) => task.status === "paused" || task.status === "sync_pending").map((task) => task.syncError ? `${task.title} — ${task.syncError}` : task.status === "sync_pending" ? `${task.title} — manual CRM completion update pending` : `${task.title} — paused`), ...tracker.map((update) => `${update.reference} — manual SharePoint tracker update pending`)]; }
  private async evidenceCount(tasks: Task[]) { let count = 0; for (const task of tasks) count += (await this.repository.evidenceFor(task.id)).length; return count; }
}

function summary(task: Task) { return task.completionDescription?.split(/\r?\n/).find((line) => line.trim().startsWith("- "))?.replace(/^\s*-\s*/, "") || task.completionDescription || task.title; }
function section(title: string, entries: string[]) { return `## ${title}\n${entries.length ? entries.map((entry) => `- ${entry}`).join("\n") : "- Nothing recorded"}`; }
function startOfDay(value: Date) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function addDays(value: Date, amount: number) { const date = new Date(value); date.setDate(date.getDate() + amount); return date; }
function previousWorkingDay(value: Date, workingDays: number[]) { let date = addDays(value, -1); while (!workingDays.includes(date.getDay())) date = addDays(date, -1); return date; }
function beginningOfWorkingWindow(ending: Date, workingDays: number[], count: number) { let date = new Date(ending); let found = workingDays.includes(date.getDay()) ? 1 : 0; while (found < count) { date = addDays(date, -1); if (workingDays.includes(date.getDay())) found += 1; } return date; }
function formatDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
