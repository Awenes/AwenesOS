import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { TaskService } from "../application/task-service.js";
import { evidenceKinds, taskSources, type Task } from "../domain/task.js";
import { LocalGitEvidenceCollector } from "../infrastructure/evidence/git-evidence-collector.js";
import type { NotificationService } from "../application/notification-service.js";
export interface GuidedIO { ask(question: string): Promise<string>; write(message: string): void; close(): void; }
export class ReadlineGuidedIO implements GuidedIO {
  private readonly rl: Interface = createInterface({ input: stdin, output: stdout });
  ask(question: string) { return this.rl.question(question); }
  write(message: string) { stdout.write(`${message}\n`); }
  close() { this.rl.close(); }
}
export class GuidedCli {
  constructor(private readonly service: TaskService, private readonly io: GuidedIO, private readonly notifications?: NotificationService) {}
  async run(): Promise<void> {
    this.io.write("\nAwenes OS — guided work session");
    let running = true;
    while (running) {
      try {
        const action = await this.choose("What do you want to do?", ["Capture a task", "Review assignment inbox", "Manage active work", "Review notifications", "Review pending CRM updates", "Review pending tracker updates", "Generate next standup", "View task history", "Exit"]);
        if (action === 0) await this.capture();
        if (action === 1) await this.reviewInbox();
        if (action === 2) await this.manageWork();
        if (action === 3) await this.reviewNotifications(); if (action === 4) await this.reviewCrmUpdates(); if (action === 5) await this.reviewTrackerUpdates();
        if (action === 6) this.io.write(`\n${await this.service.standup()}\n`); if (action === 7) await this.showHistory(); if (action === 8) running = false;
      } catch (error) { this.io.write(`\nCould not complete that action: ${messageOf(error)}\n`); }
    }
    this.io.write("Session closed. Your local data is saved.");
  }
  private async capture() {
    const title = await this.required("Task title: ");
    const source = taskSources[await this.choose("Where did it come from?", [...taskSources])]!;
    const assignmentDescription = await this.io.ask("What were you asked to do? (optional): ");
    const sourceReference = await this.io.ask("Message, issue, or URL reference (optional): ");
    const assignedToMe = await this.confirm("Was this explicitly assigned to you?");
    const task = await this.service.capture({ title, source, assignmentDescription, ...(sourceReference.trim() ? { sourceReference: sourceReference.trim() } : {}), assignedToMe, occurredAt: new Date() });
    this.io.write(`\nCaptured “${task.title}” in the assignment inbox.\nNext: review the inbox and claim it.\n`);
  }
  private async reviewInbox() {
    const task = await this.chooseTask("Choose an inbox task", await this.service.inbox());
    if (!task) return;
    const actions = task.status === "captured" ? ["Claim and plan it", "Confirm it was assigned to me", "Reject / ignore it", "Back"] : ["Claim and plan it", "Reject / ignore it", "Back"];
    const action = actions[await this.choose(`“${task.title}” is ${task.status}.`, actions)];
    if (action === "Claim and plan it") { await this.service.claim(task.id); this.io.write("Task added to active work. Next: map it to the CRM.\n"); }
    if (action === "Confirm it was assigned to me") { await this.service.confirm(task.id); this.io.write("Assignment confirmed. Claim it when accepted.\n"); }
    if (action === "Reject / ignore it") { await this.service.reject(task.id); this.io.write("Task removed from the inbox.\n"); }
  }
  private async manageWork() {
    const task = await this.chooseTask("Choose active work", await this.service.queue());
    if (!task) return;
    const actions = actionsFor(task);
    const action = actions[await this.choose(`“${task.title}” is ${task.status}.`, actions)];
    if (action === "Record CRM task reference") await this.mapCrm(task);
    if (action === "Attach or change Git repository") await this.attachRepository(task);
    if (action === "Start work") { await this.service.start(task.id); this.io.write("Work started.\n"); }
    if (action === "Pause work") { await this.service.pause(task.id); this.io.write("Work paused.\n"); }
    if (action === "Resume work") { await this.service.resume(task.id); this.io.write("Work resumed.\n"); }
    if (action === "Add completion evidence") await this.addEvidence(task);
    if (action === "Collect Git evidence") await this.collectGitEvidence(task);
    if (action === "Prepare completion") await this.prepareCompletion(task);
    if (action === "Edit completion description") await this.editCompletion(task);
    if (action === "Finish work and prepare CRM update" || action === "Retry CRM completion sync") {
      const completed = await this.service.complete(task.id);
      this.io.write(completed.status === "sync_pending" ? "Work is complete locally. Update the CRM manually, then confirm it in Awenes.\n" : "Task completed and confirmed by the CRM adapter.\n");
    }
  }

  private async reviewTrackerUpdates() {
    const updates = await this.service.pendingTrackerUpdates();
    if (!updates.length) { this.io.write("\nNo manual tracker updates are pending.\n"); return; }
    const choice = await this.choose("Choose a tracker update", [...updates.map((update) => `${update.reference} → ${update.suggestedStatus}`), "Back"]);
    const update = updates[choice];
    if (!update) return;
    this.io.write(`\nUpdate the live SharePoint tracker manually:\nReference: ${update.reference}\nStatus: ${update.suggestedStatus}\nDeveloper comment: ${update.suggestedComment}\n`);
    if (await this.confirm("Have you verified and saved this update in SharePoint?")) {
      await this.service.confirmTrackerUpdate(update.taskId);
      this.io.write("Manual tracker update confirmed and recorded.\n");
    }
  }
  private async reviewCrmUpdates() {
    const updates = await this.service.pendingManualCrmUpdates(); if (!updates.length) { this.io.write("\nNo manual CRM updates are pending.\n"); return; }
    const update = updates[await this.choose("Choose a CRM update", [...updates.map((item) => `${item.desiredStatus}${item.description ? " — completion description ready" : ""}`), "Back"])]; if (!update) return;
    const summary = await this.service.taskSummary(update.taskId); this.io.write(`\nUpdate the CRM manually:\nTask: ${summary.task.title}\nStatus: ${update.desiredStatus}\n${update.description ? `Description:\n${update.description}\n` : ""}Active duration: ${summary.duration.active}\nPaused duration: ${summary.duration.paused}\n`);
    if (await this.confirm("Have you verified and saved this update in the CRM?")) { const result = await this.service.confirmManualCrmUpdate(update.taskId); this.io.write(result.task.status === "completed" ? "CRM completion confirmed; task is now completed.\n" : "CRM status update confirmed.\n"); }
  }
  private async reviewNotifications() {
    if (!this.notifications) { this.io.write("\nNotification centre is unavailable.\n"); return; }
    const entries = await this.notifications.list(); if (!entries.length) { this.io.write("\nNo actionable notifications.\n"); return; }
    const selected = entries[await this.choose("Choose a notification", [...entries.map((entry) => `[${entry.severity}] ${entry.title}`), "Back"])]; if (!selected) return;
    this.io.write(`\n${selected.title}\n${selected.detail}\nNext: ${selected.suggestedAction}\n`);
    const action = await this.choose("Notification action", ["Snooze for one hour", "Dismiss this occurrence", "Back"]);
    if (action === 0) { await this.notifications.snoozeFor(selected.key, "1h"); this.io.write("Notification snoozed for one hour.\n"); }
    if (action === 1) { await this.notifications.dismiss(selected.key); this.io.write("Notification dismissed.\n"); }
  }

  private async mapCrm(task: Task) {
    const projectId = await this.required("CRM project ID: ");
    const externalTaskId = await this.required("Existing CRM task ID or reference: "); const externalUrl = await this.io.ask("CRM task URL (optional): ");
    await this.service.mapToCrm(task.id, projectId, externalTaskId, externalUrl.trim() || undefined); this.io.write("CRM reference saved. Next: start the task locally.\n");
  }
  private async addEvidence(task: Task) {
    const kind = evidenceKinds[await this.choose("Evidence type", [...evidenceKinds])]!;
    await this.service.addEvidence(task.id, kind, await this.required("Evidence details: "));
    this.io.write("Evidence recorded.\n");
  }
  private async attachRepository(task: Task) {
    const repository = (await this.io.ask("Git repository path (leave blank for current directory): ")).trim() || ".";
    const mapping = await this.service.attachRepository(task.id, repository, new LocalGitEvidenceCollector());
    this.io.write(`Attached ${mapping.repositoryRoot} on ${mapping.branchAtMapping}.\n`);
  }
  private async collectGitEvidence(task: Task) {
    const result = await this.service.collectGitEvidence(task.id, undefined, new LocalGitEvidenceCollector());
    this.io.write(`Collected ${result.added} evidence item(s) from ${result.branch}; ${result.skippedExisting} already recorded.\n`);
  }
  private async prepareCompletion(task: Task) {
    const note = await this.io.ask("Completion summary (leave blank to draft from evidence): ");
    const description = await this.service.prepareCompletion(task.id, note.trim() || undefined);
    this.io.write(`\nCompletion description:\n${description}\n\nNext: edit it if needed, then complete and sync.\n`);
  }
  private async editCompletion(task: Task) {
    await this.service.editCompletion(task.id, await this.required("New completion description: "));
    this.io.write("Completion description updated.\n");
  }
  private async showHistory() {
    const task = await this.chooseTask("Choose a task", await this.service.allTasks());
    if (!task) return;
    const events = await this.service.history(task.id);
    this.io.write(`\nHistory for “${task.title}”:`);
    for (const event of events) this.io.write(`- ${event.occurredAt.toISOString()} — ${event.type}`);
    this.io.write("");
  }
  private async chooseTask(question: string, tasks: Task[]): Promise<Task | null> {
    if (!tasks.length) { this.io.write("\nNothing here yet.\n"); return null; }
    const choice = await this.choose(question, [...tasks.map((task) => `${task.title} [${task.status}]`), "Back"]);
    return tasks[choice] ?? null;
  }
  private async choose(question: string, options: string[]): Promise<number> {
    this.io.write(`\n${question}`);
    options.forEach((option, index) => this.io.write(`  ${index + 1}. ${option}`));
    while (true) {
      const answer = Number.parseInt(await this.io.ask("Choose a number: "), 10);
      if (answer >= 1 && answer <= options.length) return answer - 1;
      this.io.write(`Enter a number from 1 to ${options.length}.`);
    }
  }
  private async confirm(question: string): Promise<boolean> {
    while (true) {
      const answer = (await this.io.ask(`${question} (y/n): `)).trim().toLowerCase();
      if (["y", "yes"].includes(answer)) return true;
      if (["n", "no"].includes(answer)) return false;
      this.io.write("Enter y or n.");
    }
  }
  private async required(question: string): Promise<string> {
    while (true) { const answer = (await this.io.ask(question)).trim(); if (answer) return answer; this.io.write("This value is required."); }
  }
}

function actionsFor(task: Task): string[] {
  if (task.status === "planned") return ["Record CRM task reference", "Attach or change Git repository", "Start work", "Back"];
  if (task.status === "in_progress") return ["Pause work", "Attach or change Git repository", "Add completion evidence", "Collect Git evidence", "Prepare completion", "Back"];
  if (task.status === "paused") return ["Resume work", "Attach or change Git repository", "Add completion evidence", "Collect Git evidence", "Prepare completion", "Back"];
  if (task.status === "ready_to_complete") return ["Edit completion description", "Finish work and prepare CRM update", "Back"];
  if (task.status === "sync_pending") return ["Edit completion description", "Back"];
  return ["Back"];
}
function messageOf(error: unknown) { return error instanceof Error ? error.message : String(error); }
