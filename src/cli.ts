#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { TaskService } from "./application/task-service.js";
import { TaskSourceSchema, taskSources } from "./domain/task.js";
import { ManualCrmAdapter } from "./infrastructure/crm/manual-crm-adapter.js";
import { openDatabase } from "./infrastructure/db/database.js";
import { TaskRepository } from "./infrastructure/repositories/task-repository.js";
import { GuidedCli, ReadlineGuidedIO } from "./cli/guided-cli.js";
import { readFile } from "node:fs/promises";
import { TrackerImportService } from "./application/tracker-import-service.js";
import { TrackerImportConfigSchema } from "./domain/tracker.js";
import { CsvTrackerAdapter } from "./infrastructure/tracker/csv-tracker-adapter.js";
import { LocalGitEvidenceCollector } from "./infrastructure/evidence/git-evidence-collector.js";
import { NotificationService } from "./application/notification-service.js";
import { createDatabaseBackup } from "./infrastructure/db/migration-runner.js";
import { inspectDatabase } from "./infrastructure/db/database-doctor.js";
import { ReportingService } from "./application/reporting-service.js";
import { ReportDateSchema } from "./domain/reporting.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const { db, client, path: databasePath, migration } = await openDatabase();
const repository = new TaskRepository(db);
const service = new TaskService(repository, new ManualCrmAdapter(), "manual");
const notifications = new NotificationService(repository);
const reporting = new ReportingService(repository);
const cli = new Command().name("awenes").description("Awenes OS local-first work engine").version("0.1.0");

async function guided() {
  const io = new ReadlineGuidedIO();
  try { await new GuidedCli(service, io, notifications).run(); }
  finally { io.close(); }
}
cli.action(guided);
cli.command("guided").description("Open the guided interactive work session").action(guided);

cli.command("capture")
  .description("Quickly capture a task into the assignment inbox")
  .argument("<title>")
  .requiredOption("-s, --source <source>", `one of: ${taskSources.join(", ")}`)
  .option("-d, --description <text>", "assignment description", "")
  .option("-r, --reference <value>", "source message, URL, or issue reference")
  .option("--assigned", "mark as explicitly assigned to me")
  .action(async (title, options) => print(await service.capture({ title, source: TaskSourceSchema.parse(options.source), assignmentDescription: options.description, sourceReference: options.reference, assignedToMe: Boolean(options.assigned), occurredAt: new Date() })));

cli.command("inbox").action(async () => table(await service.inbox()));
cli.command("queue").action(async () => table(await service.queue()));
cli.command("confirm").argument("<id>").action(async (id) => print(await service.confirm(id)));
cli.command("claim").argument("<id>").action(async (id) => print(await service.claim(id)));
cli.command("reject").argument("<id>").action(async (id) => print(await service.reject(id)));

cli.command("crm-map")
  .description("Record an existing CRM task reference for manual coordination")
  .argument("<id>").requiredOption("-p, --project <projectId>").requiredOption("-e, --external-id <id>").option("-u, --url <url>")
  .action(async (id, options) => print(await service.mapToCrm(id, options.project, options.externalId, options.url)));
cli.command("crm-updates").description("List CRM changes awaiting manual update and confirmation").action(async () => table(await service.pendingManualCrmUpdates()));
cli.command("crm-confirm").description("Confirm that the current CRM instruction was manually applied").argument("<taskId>").action(async (taskId) => print(await service.confirmManualCrmUpdate(taskId)));
cli.command("duration").description("Show active, paused, and calendar duration for a task").argument("<taskId>").action(async (taskId) => print(await service.duration(taskId)));
cli.command("task-summary").description("Show task details, timing, evidence, mappings, and pending CRM work").argument("<taskId>").action(async (taskId) => print(await service.taskSummary(taskId)));

for (const command of ["start", "pause", "resume"] as const) {
  cli.command(command).argument("<id>").action(async (id) => print(await service[command](id)));
}

cli.command("evidence").argument("<id>").requiredOption("-k, --kind <kind>").requiredOption("-v, --value <value>").action(async (id, options) => { await service.addEvidence(id, options.kind, options.value); console.log("Evidence recorded."); });
cli.command("repo-attach").description("Attach or change the local Git repository for a task").argument("<id>").argument("[repository]", "Git repository path", ".").action(async (id, repository) => print(await service.attachRepository(id, repository, new LocalGitEvidenceCollector())));
cli.command("repo-show").description("Show the Git repository attached to a task").argument("<id>").action(async (id) => print(await service.repositoryMapping(id)));
cli.command("git-evidence").description("Collect commit and changed-file metadata since work started").argument("<id>").argument("[repository]", "optional one-time repository override").action(async (id, repository) => print(await service.collectGitEvidence(id, repository, new LocalGitEvidenceCollector())));
cli.command("prepare-completion").argument("<id>").option("-n, --note <text>", "use this editable completion description").action(async (id, options) => console.log(await service.prepareCompletion(id, options.note)));
cli.command("draft-completion").description("Preview a structured completion draft without changing task state").argument("<id>").action(async (id) => console.log(await service.draftCompletion(id)));
cli.command("edit-completion").argument("<id>").requiredOption("-d, --description <text>").action(async (id, options) => { await service.editCompletion(id, options.description); console.log("Completion description updated."); });
cli.command("complete").argument("<id>").action(async (id) => print(await service.complete(id)));
cli.command("history").argument("<id>").action(async (id) => table(await service.history(id)));
cli.command("standup").description("Generate a Markdown standup for a local date").argument("[date]", "today, yesterday, or YYYY-MM-DD", "today").option("-o, --output <file>", "write Markdown to a file").action(async (date, options) => outputReport(await reporting.standup(ReportDateSchema.parse(date)), options.output));
cli.command("weekly-review").description("Generate a five-working-day Markdown review").argument("[ending]", "today or YYYY-MM-DD", "today").option("-o, --output <file>", "write Markdown to a file").action(async (ending, options) => outputReport(await reporting.weeklyReview(ReportDateSchema.parse(ending)), options.output));
cli.command("notifications").description("List actionable local reminders").action(async () => table(await notifications.list()));
cli.command("notification-dismiss").description("Dismiss the current occurrence of a notification").argument("<key>").action(async (key) => print(await notifications.dismiss(key)));
cli.command("notification-snooze").description("Snooze a notification for a friendly duration such as 30m, 1h, or 1d").argument("<key>").argument("[duration]", "duration: m=minutes, h=hours, d=days", "1h").action(async (key, duration) => print(await notifications.snoozeFor(key, duration)));
cli.command("doctor").description("Check database integrity, foreign keys, and migration version").action(async () => print({ databasePath, migration, ...(await inspectDatabase(client)) }));
cli.command("backup").description("Create a consistent local database backup").option("-o, --output <file>", "backup destination").action(async (options) => print({ backupPath: await createDatabaseBackup(client, databasePath, options.output) }));
cli.command("tracker-updates").description("List completed tracker tasks awaiting your manual SharePoint update").action(async () => table(await service.pendingTrackerUpdates()));
cli.command("tracker-confirm").description("Confirm that you manually updated the live SharePoint tracker").argument("<taskId>").action(async (taskId) => print(await service.confirmTrackerUpdate(taskId)));
cli.command("tracker-import")
  .description("Import tracker CSV rows as unassigned inbox candidates")
  .argument("<file>")
  .requiredOption("-c, --config <file>", "JSON column/status mapping configuration")
  .action(async (file, options) => {
    const config = TrackerImportConfigSchema.parse(JSON.parse(await readFile(options.config, "utf8")));
    print(await new TrackerImportService(repository, new CsvTrackerAdapter()).import(file, config));
  });

try { await cli.parseAsync(process.argv); }
catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { client.close(); }

function print(value: unknown) { console.log(JSON.stringify(value, null, 2)); }
function table(rows: object[]) { rows.length ? console.table(rows) : console.log("No tasks found."); }
async function outputReport(markdown: string, output?: string) { if (!output) { console.log(markdown); return; } const path = resolve(output); await writeFile(path, `${markdown}\n`, "utf8"); console.log(`Report written to ${path}`); }
