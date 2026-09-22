#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { TaskService } from "./application/task-service.js";
import { TaskSourceSchema, taskSources } from "./domain/task.js";
import { openDatabase } from "./infrastructure/db/database.js";
import { TaskRepository } from "./infrastructure/repositories/task-repository.js";
import { GuidedCli, ReadlineGuidedIO } from "./cli/guided-cli.js";
import { readFile } from "node:fs/promises";
import { NotificationService } from "./application/notification-service.js";
import { createDatabaseBackup } from "./infrastructure/db/migration-runner.js";
import { inspectDatabase } from "./infrastructure/db/database-doctor.js";
import { ProjectService } from "./application/project-service.js";
import { CompletionPolicySchema, ExecutionPolicySchema } from "./domain/project.js";
import { LocalEnvironmentInspector } from "./infrastructure/environment/local-environment-inspector.js";
import { ProjectRepository } from "./infrastructure/repositories/project-repository.js";
import { WorktreeService } from "./application/worktree-service.js";
import { LocalWorktreeDriver } from "./infrastructure/git/local-worktree-driver.js";
import { LocalGitRepositoryInitializer } from "./infrastructure/git/local-git-repository-initializer.js";
import { AgentRoleService } from "./application/agent-role-service.js";
import { AgentRoleInputSchema } from "./domain/agent-role.js";
import { AgentRoleRepository } from "./infrastructure/repositories/agent-role-repository.js";

const { db, client, path: databasePath, migration } = await openDatabase();
const repository = new TaskRepository(db);
const service = new TaskService(repository);
const notifications = new NotificationService(repository);
const projectRepository = new ProjectRepository(db);
const projectService = new ProjectService(projectRepository, new LocalEnvironmentInspector());
const worktrees = new WorktreeService(projectRepository, repository, new LocalWorktreeDriver(), new LocalGitRepositoryInitializer());
const roleRepository = new AgentRoleRepository(db);
const roles = new AgentRoleService(roleRepository, projectRepository);
await roles.initializeBuiltIns();
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

cli.command("duration").description("Show active, paused, and calendar duration for a task").argument("<taskId>").action(async (taskId) => print(await service.duration(taskId)));
cli.command("task-summary").description("Show task details, timing, and evidence").argument("<taskId>").action(async (taskId) => print(await service.taskSummary(taskId)));

for (const command of ["start", "pause", "resume"] as const) {
  cli.command(command).argument("<id>").action(async (id) => print(await service[command](id)));
}

cli.command("prepare-completion").argument("<id>").option("-n, --note <text>", "use this editable completion description").action(async (id, options) => console.log(await service.prepareCompletion(id, options.note)));
cli.command("draft-completion").description("Preview a structured completion draft without changing task state").argument("<id>").action(async (id) => console.log(await service.draftCompletion(id)));
cli.command("edit-completion").argument("<id>").requiredOption("-d, --description <text>").action(async (id, options) => { await service.editCompletion(id, options.description); console.log("Completion description updated."); });
cli.command("complete").argument("<id>").action(async (id) => print(await service.complete(id)));
cli.command("history").argument("<id>").action(async (id) => table(await service.history(id)));
cli.command("notifications").description("List actionable local reminders").action(async () => table(await notifications.list()));
cli.command("notification-dismiss").description("Dismiss the current occurrence of a notification").argument("<key>").action(async (key) => print(await notifications.dismiss(key)));
cli.command("notification-snooze").description("Snooze a notification for a friendly duration such as 30m, 1h, or 1d").argument("<key>").argument("[duration]", "duration: m=minutes, h=hours, d=days", "1h").action(async (key, duration) => print(await notifications.snoozeFor(key, duration)));
cli.command("doctor").description("Check database integrity, foreign keys, and migration version").action(async () => print({ databasePath, migration, ...(await inspectDatabase(client)) }));
cli.command("backup").description("Create a consistent local database backup").option("-o, --output <file>", "backup destination").action(async (options) => print({ backupPath: await createDatabaseBackup(client, databasePath, options.output) }));
cli.command("project-add")
  .description("Register a local project and its default completion policy")
  .argument("<name>").argument("[repository]", "local Git repository path", ".")
  .option("-b, --branch <branch>", "default branch", "main")
  .option("-p, --policy <policy>", "manual, approve_push, or auto_push", "manual")
  .action(async (name, repository, options) => print(await projectService.register({ name, repositoryRoot: repository, defaultBranch: options.branch, completionPolicy: CompletionPolicySchema.parse(options.policy) })));
cli.command("projects").description("List registered local projects").action(async () => table(await projectService.list()));
cli.command("project-doctor").description("Check whether a project is ready for isolated agent execution").argument("<projectId>").action(async (projectId) => print(await projectService.readiness(projectId)));
cli.command("project-policy").description("Change a project's completion policy").argument("<projectId>").argument("<policy>", "manual, approve_push, or auto_push").action(async (projectId, policy) => print(await projectService.setCompletionPolicy(projectId, CompletionPolicySchema.parse(policy))));
cli.command("task-project").description("Assign or move a task to a registered project").argument("<taskId>").argument("<projectId>").action(async (taskId, projectId) => print(await service.assignProject(taskId, projectId, projectRepository)));
cli.command("project-tasks").description("List tasks assigned to a project").argument("<projectId>").action(async (projectId) => table(await service.tasksForProject(projectId)));
cli.command("execution-policy-show").description("Show a project's effective execution permissions").argument("<projectId>").action(async (projectId) => print(await projectService.executionPolicy(projectId)));
cli.command("execution-policy-set").description("Replace a project's execution permissions from JSON").argument("<projectId>").requiredOption("-c, --config <file>").action(async (projectId, options) => print(await projectService.setExecutionPolicy(projectId, ExecutionPolicySchema.parse(JSON.parse(await readFile(options.config, "utf8"))))));
cli.command("worktree-create").description("Create an isolated task branch and worktree").argument("<taskId>").action(async (taskId) => print(await worktrees.create(taskId)));
cli.command("worktree-release").description("Remove and release an isolated task worktree after review").argument("<taskId>").action(async (taskId) => print(await worktrees.release(taskId)));
cli.command("roles").description("List built-in and project-specific agent roles").option("-p, --project <projectId>").action(async (options) => table(await roles.list(options.project)));
cli.command("role-show").description("Show an agent role and its effective configuration").argument("<roleId>").action(async (roleId) => print(await roles.get(roleId)));
cli.command("role-create").description("Create a custom agent role from JSON").requiredOption("-c, --config <file>").action(async (options) => print(await roles.create(AgentRoleInputSchema.parse(JSON.parse(await readFile(options.config, "utf8"))))));
cli.command("role-model").description("Assign a provider and model to an agent role").argument("<roleId>").requiredOption("--provider <providerId>").requiredOption("--model <modelId>").action(async (roleId, options) => print(await roles.assignModel(roleId, options.provider, options.model)));
cli.command("role-enable").description("Enable an agent role").argument("<roleId>").action(async (roleId) => print(await roles.setEnabled(roleId, true)));
cli.command("role-disable").description("Disable an agent role").argument("<roleId>").action(async (roleId) => print(await roles.setEnabled(roleId, false)));

try { await cli.parseAsync(process.argv); }
catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { client.close(); }

function print(value: unknown) { console.log(JSON.stringify(value, null, 2)); }
function table(rows: object[]) { rows.length ? console.table(rows) : console.log("No tasks found."); }
