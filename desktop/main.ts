import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  protocol,
  session,
} from "electron";
import { extname, join, normalize, resolve, sep } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { DesktopSnapshot } from "./contracts.js";
import { AgentRoleService } from "../src/application/agent-role-service.js";
import { BrowserTestService } from "../src/application/browser-test-service.js";
import { detectLocalBrowserSetup } from "../src/infrastructure/browser/local-browser-setup-detector.js";
import { GitDeliveryService } from "../src/application/git-delivery-service.js";
import { InstructionService } from "../src/application/instruction-service.js";
import { NotificationService } from "../src/application/notification-service.js";
import { ProjectService } from "../src/application/project-service.js";
import { ProviderService } from "../src/application/provider-service.js";
import { TaskService } from "../src/application/task-service.js";
import { WorkflowEngine } from "../src/application/workflow-engine.js";
import { WorkflowService } from "../src/application/workflow-service.js";
import { WorktreeService } from "../src/application/worktree-service.js";
import { AgentRoleInputSchema } from "../src/domain/agent-role.js";
import { BrowserTestConfigSchema } from "../src/domain/browser-test.js";
import { SkillSnapshotInputSchema } from "../src/domain/instruction.js";
import {
  CompletionPolicySchema,
  ExecutionPolicySchema,
} from "../src/domain/project.js";
import { ProviderConnectionInputSchema } from "../src/domain/provider.js";
import { TaskSourceSchema } from "../src/domain/task.js";
import { PlaywrightBrowserAutomation } from "../src/infrastructure/browser/playwright-browser-automation.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { LocalEnvironmentInspector } from "../src/infrastructure/environment/local-environment-inspector.js";
import { GuardedCommandExecutor } from "../src/infrastructure/execution/guarded-command-executor.js";
import { WorktreeToolHost } from "../src/infrastructure/execution/worktree-tool-host.js";
import { LocalGitDeliveryDriver } from "../src/infrastructure/git/local-git-delivery-driver.js";
import { LocalGitRepositoryInitializer } from "../src/infrastructure/git/local-git-repository-initializer.js";
import { LocalWorktreeDriver } from "../src/infrastructure/git/local-worktree-driver.js";
import { ApiAgentRunner } from "../src/infrastructure/providers/api-agent-runner.js";
import { CliAgentRunner } from "../src/infrastructure/providers/cli-agent-runner.js";
import { LocalProviderProbe } from "../src/infrastructure/providers/local-provider-probe.js";
import { AgentRoleRepository } from "../src/infrastructure/repositories/agent-role-repository.js";
import { BrowserTestRepository } from "../src/infrastructure/repositories/browser-test-repository.js";
import { GitDeliveryRepository } from "../src/infrastructure/repositories/git-delivery-repository.js";
import { InstructionRepository } from "../src/infrastructure/repositories/instruction-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { ProviderRepository } from "../src/infrastructure/repositories/provider-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { WorkflowRepository } from "../src/infrastructure/repositories/workflow-repository.js";
import { EncryptedSecretVault } from "./encrypted-secret-vault.js";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "awenes",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let mainWindow: BrowserWindow | null = null;
void app
  .whenReady()
  .then(start)
  .catch((error) => {
    console.error(error);
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
async function start() {
  const rendererRoot = resolve(app.getAppPath(), "dist-desktop", "renderer");
  protocol.handle("awenes", async (request) => {
    const requested = normalize(
        new URL(request.url).pathname.replace(/^\//, "") || "index.html",
      ),
      file = resolve(rendererRoot, requested);
    if (file !== rendererRoot && !file.startsWith(`${rendererRoot}${sep}`))
      return new Response("Not found", { status: 404 });
    try {
      return new Response(new Uint8Array(await readFile(file)), {
        headers: { "content-type": contentType(file) },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  const databasePath =
      process.env.AWENES_DB_PATH ||
      (app.isPackaged
        ? join(app.getPath("userData"), "awenes.db")
        : "./data/awenes.db"),
    opened = await openDatabase(databasePath);
  const tasks = new TaskRepository(opened.db),
    projects = new ProjectRepository(opened.db),
    roles = new AgentRoleRepository(opened.db),
    providers = new ProviderRepository(opened.db),
    instructions = new InstructionRepository(opened.db),
    runs = new WorkflowRepository(opened.db),
    browserRepository = new BrowserTestRepository(opened.db),
    deliveries = new GitDeliveryRepository(opened.db),
    vault = new EncryptedSecretVault(
      join(app.getPath("userData"), "secrets.json"),
    );
  const taskService = new TaskService(tasks),
    projectService = new ProjectService(
      projects,
      new LocalEnvironmentInspector(),
      new LocalGitRepositoryInitializer(),
    ),
    roleService = new AgentRoleService(roles, projects),
    providerService = new ProviderService(
      providers,
      vault,
      new LocalProviderProbe(),
    ),
    instructionService = new InstructionService(instructions, roles),
    workflowService = new WorkflowService(
      runs,
      tasks,
      projects,
      roles,
      instructionService,
    ),
    worktreeService = new WorktreeService(
      projects,
      tasks,
      new LocalWorktreeDriver(),
      new LocalGitRepositoryInitializer(),
    ),
    notificationService = new NotificationService(tasks, runs),
    gitService = new GitDeliveryService(
      deliveries,
      runs,
      projects,
      new LocalGitDeliveryDriver(),
    );
  const runnerFactory = {
    create: (provider: any, worktree: any, policy: any) => {
      const commands = new GuardedCommandExecutor(worktree.path, policy);
      return provider.authMethod === "api_key"
        ? new ApiAgentRunner(
            vault,
            (root, capabilities) =>
              new WorktreeToolHost(root, policy, commands, capabilities),
          )
        : new CliAgentRunner(commands);
    },
  };
  const workflowEngine = new WorkflowEngine(
    runs,
    tasks,
    projects,
    roles,
    providers,
    worktreeService,
    runnerFactory,
  );
  const outputRoot = app.isPackaged
    ? join(app.getPath("userData"), "outputs")
    : resolve("outputs");
  const browserService = new BrowserTestService(
    browserRepository,
    projects,
    vault,
    new PlaywrightBrowserAutomation(),
    async (root, projectId) =>
      new GuardedCommandExecutor(
        root,
        await projects.executionPolicy(projectId),
      ),
    outputRoot,
  );
  await roleService.initializeBuiltIns();
  await assignUnconfiguredRoles(roleService, providerService);
  await instructionService.initializeBuiltIns();
  await workflowService.recoverInterrupted();
  app.on("before-quit", () => {
    opened.client.close();
  });
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 680,
    show: true,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: join(
        app.getAppPath(),
        "dist-desktop",
        "main",
        "desktop",
        "preload.cjs",
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("awenes://")) event.preventDefault();
  });
  session.defaultSession.setPermissionRequestHandler((_w, _p, callback) =>
    callback(false),
  );
  const desktopServices: Services = {
    taskService,
    projectService,
    roleService,
    providerService,
    instructionService,
    workflowService,
    workflowEngine,
    browserService,
    gitService,
    notificationService,
    projects,
    deliveries,
  };
  registerIpc(mainWindow, desktopServices);
  await mainWindow.loadURL("awenes://app/index.html");
  for (const run of await workflowService.list()) {
    if (run.status === "running")
      void runAutomatically(run.id, desktopServices);
  }
  startNotificationPump(notificationService);
  const capturePath = process.argv
    .find((value) => value.startsWith("capture="))
    ?.slice(8);
  if (capturePath) {
    mainWindow.webContents.debugger.attach("1.3");
    const result = (await mainWindow.webContents.debugger.sendCommand(
      "Page.captureScreenshot",
      { format: "png" },
    )) as { data: string };
    mainWindow.webContents.debugger.detach();
    await writeFile(resolve(capturePath), Buffer.from(result.data, "base64"));
    app.quit();
  }
}

function startNotificationPump(service: NotificationService) {
  if (!Notification.isSupported()) return;
  const shown = new Set<string>();
  const check = async () => {
    for (const item of await service.list()) {
      if (shown.has(item.key) || item.severity === "info") continue;
      shown.add(item.key);
      const notification = new Notification({
        title: item.title,
        body: item.detail,
        silent: item.severity !== "critical",
      });
      notification.on("click", () => {
        mainWindow?.show();
        mainWindow?.focus();
      });
      notification.show();
    }
  };
  void check();
  const timer = setInterval(() => void check(), 60_000);
  app.once("before-quit", () => clearInterval(timer));
}
type Services = {
  taskService: TaskService;
  projectService: ProjectService;
  roleService: AgentRoleService;
  providerService: ProviderService;
  instructionService: InstructionService;
  workflowService: WorkflowService;
  workflowEngine: WorkflowEngine;
  browserService: BrowserTestService;
  gitService: GitDeliveryService;
  notificationService: NotificationService;
  projects: ProjectRepository;
  deliveries: GitDeliveryRepository;
};
function registerIpc(window: BrowserWindow, s: Services) {
  const trusted = (sender: Electron.WebContents) =>
    sender === window.webContents &&
    sender.getURL().startsWith("awenes://app/");
  const handle = <T>(
    channel: string,
    operation: (input: unknown) => Promise<T>,
  ) =>
    ipcMain.handle(channel, async (event, input) => {
      if (!trusted(event.sender)) throw new Error("Untrusted desktop request");
      return operation(input);
    });
  handle("awenes:snapshot", async () => {
    const [
      projects,
      tasks,
      archivedTasks,
      roles,
      providers,
      runs,
      archivedRuns,
      notifications,
    ] = await Promise.all([
      s.projectService.list(),
      s.taskService.allTasks(),
      s.taskService.archivedTasks(),
      s.roleService.list(),
      s.providerService.list(),
      s.workflowService.list(),
      s.workflowService.archived(),
      s.notificationService.list(),
    ]);
    const approvals = (
      await Promise.all(
        runs.map(async (run) => {
          const [items, plans] = await Promise.all([
            s.workflowService.approvals(run.id),
            s.workflowService.plans(run.id),
          ]);
          const latest = plans[0];
          return items.map((value) =>
            value.kind === "plan" && latest
              ? {
                  ...value,
                  planContent: latest.content,
                  planVersion: latest.version,
                }
              : value,
          );
        }),
      )
    )
      .flat()
      .filter((value) => value.status === "pending");
    const runSteps = await Promise.all(
      runs.map((run) => s.workflowService.steps(run.id)),
    );
    const archivedRunSteps = await Promise.all(
      archivedRuns.map((run) => s.workflowService.steps(run.id)),
    );
    return {
      projects,
      tasks,
      archivedTasks,
      roles,
      providers,
      runs: runs.map((run, index) => ({
        ...run,
        stepStatus:
          runSteps[index]?.find((step) => step.stage === run.currentStage)
            ?.status ?? null,
      })),
      archivedRuns: archivedRuns.map((run, index) => ({
        ...run,
        stepStatus:
          archivedRunSteps[index]?.find((step) => step.stage === run.currentStage)
            ?.status ?? null,
      })),
      approvals,
      notifications,
    } satisfies DesktopSnapshot;
  });
  handle("awenes:data:export", async () => {
    const result = await dialog.showSaveDialog(window, {
      title: "Export AwenesOS data",
      defaultPath: `awenes-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const [projects, tasks, archivedTasks, runs, archivedRuns, roles, providers] =
      await Promise.all([
        s.projectService.list(),
        s.taskService.allTasks(),
        s.taskService.archivedTasks(),
        s.workflowService.list(),
        s.workflowService.archived(),
        s.roleService.list(),
        s.providerService.list(),
      ]);
    const payload = {
      format: "AwenesOS export",
      version: 1,
      generatedAt: new Date().toISOString(),
      projects,
      tasks,
      archivedTasks,
      workflowRuns: runs,
      archivedWorkflowRuns: archivedRuns,
      agentRoles: roles.map(
        ({ promptTemplate: _promptTemplate, ...role }) => role,
      ),
      providers: providers.map(
        ({ command: _command, ...provider }) => provider,
      ),
    };
    await writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf8");
    return result.filePath;
  });
  handle("awenes:project:add", async (input) => {
    const value = z
      .object({
        name: z.string(),
        repositoryRoot: z.string(),
        defaultBranch: z.string(),
        completionPolicy: CompletionPolicySchema,
        autonomyMode: z.enum(["guided", "balanced", "autonomous"]),
        initializeGit: z.boolean(),
      })
      .parse(input);
    await s.projectService.register(value);
  });
  handle("awenes:project:select-directory", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Select a local Git repository",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle("awenes:project:readiness", async (input) =>
    s.projectService.readiness(z.string().uuid().parse(input)),
  );
  handle("awenes:policy:get", async (input) =>
    s.projectService.executionPolicy(z.string().uuid().parse(input)),
  );
  handle("awenes:policy:set", async (input) => {
    const value = z
      .object({ projectId: z.string().uuid(), policy: ExecutionPolicySchema })
      .parse(input);
    await s.projectService.setExecutionPolicy(value.projectId, value.policy);
  });
  handle("awenes:task:capture", async (input) => {
    const value = z
      .object({
        title: z.string(),
        source: TaskSourceSchema,
        description: z.string(),
        acceptanceCriteria: z.array(z.string()),
        projectId: z.string().uuid().nullable(),
      })
      .parse(input);
    const task = await s.taskService.capture({
      title: value.title,
      source: value.source,
      assignmentDescription: value.description,
      acceptanceCriteria: value.acceptanceCriteria,
      assignedToMe: Boolean(value.projectId),
      occurredAt: new Date(),
    });
    if (value.projectId) {
      await s.taskService.assignProject(task.id, value.projectId, s.projects);
      await s.taskService.claim(task.id);
      await s.taskService.start(task.id);
      const created = await s.workflowService.create(task.id);
      await s.workflowService.decide(created.approval.id, true);
      void runAutomatically(created.run.id, s);
    }
  });
  handle("awenes:task:action", async (input) => {
    const value = z
      .object({
        taskId: z.string().uuid(),
        action: z.enum([
          "claim",
          "start",
          "pause",
          "resume",
          "archive",
          "restore",
          "delete",
        ]),
      })
      .parse(input);
    const run = await s.workflowService.latestForTask(value.taskId);
    if (value.action === "pause" && run) {
      if (!["completed", "cancelled"].includes(run.status))
        await s.workflowService.pause(run.id);
      await s.taskService.pause(value.taskId);
      return;
    }
    if (value.action === "resume" && run) {
      await s.taskService.resume(value.taskId);
      if (run.status === "paused" || run.status === "failed") {
        await s.workflowService.resume(run.id);
        void runAutomatically(run.id, s);
      }
      return;
    }
    await s.taskService[value.action](value.taskId);
  });
  handle("awenes:task:summary", async (input) =>
    s.taskService.taskSummary(z.string().uuid().parse(input)),
  );
  handle("awenes:task:completion-draft", async (input) =>
    s.taskService.draftCompletion(z.string().uuid().parse(input)),
  );
  handle("awenes:task:completion", async (input) => {
    const value = z
      .object({
        taskId: z.string().uuid(),
        action: z.enum(["prepare", "edit", "finish"]),
        description: z.string().optional(),
      })
      .parse(input);
    if (value.action === "prepare")
      await s.taskService.prepareCompletion(value.taskId, value.description);
    else if (value.action === "edit")
      await s.taskService.editCompletion(
        value.taskId,
        z.string().trim().min(1).parse(value.description),
      );
    else await s.taskService.complete(value.taskId);
  });
  handle("awenes:role:create", async (input) => {
    await s.roleService.create(AgentRoleInputSchema.parse(input));
  });
  handle("awenes:role:enabled", async (input) => {
    const value = z
      .object({ roleId: z.string().uuid(), enabled: z.boolean() })
      .parse(input);
    await s.roleService.setEnabled(value.roleId, value.enabled);
  });
  handle("awenes:role:model", async (input) => {
    const value = z
      .object({
        roleId: z.string().uuid(),
        providerId: z.string().uuid(),
        modelId: z.string().min(1),
      })
      .parse(input);
    await s.roleService.assignModel(
      value.roleId,
      value.providerId,
      value.modelId,
    );
  });
  handle("awenes:prompt:details", async (input) => {
    const roleId = z.string().uuid().parse(input);
    return {
      history: await s.instructionService.promptHistory(roleId),
      effective: await s.instructionService.effective(roleId),
    };
  });
  handle("awenes:prompt:save", async (input) => {
    const value = z
      .object({ roleId: z.string().uuid(), content: z.string() })
      .parse(input);
    await s.instructionService.savePrompt(value.roleId, value.content);
  });
  handle("awenes:prompt:reset", async (input) => {
    await s.instructionService.resetPrompt(z.string().uuid().parse(input));
  });
  handle("awenes:skills:list", async (input) =>
    s.instructionService.listSkills(
      input ? z.string().uuid().parse(input) : undefined,
    ),
  );
  handle("awenes:skills:save", async (input) => {
    await s.instructionService.saveSkill(SkillSnapshotInputSchema.parse(input));
  });
  handle("awenes:skills:attach", async (input) => {
    const value = z
      .object({
        roleId: z.string().uuid(),
        skillId: z.string().uuid(),
        attached: z.boolean(),
      })
      .parse(input);
    if (value.attached)
      await s.instructionService.attachSkill(value.roleId, value.skillId);
    else await s.instructionService.detachSkill(value.roleId, value.skillId);
  });
  handle("awenes:provider:connect", async (input) => {
    const value = z
        .object({
          name: z.string(),
          kind: z.string(),
          authMethod: z.string(),
          command: z.string().nullable(),
          models: z.array(z.string()),
          apiKey: z.string().optional(),
        })
        .parse(input),
      { apiKey, ...connection } = value;
    const connected = await s.providerService.connect(
      ProviderConnectionInputSchema.parse(connection),
      apiKey,
    );
    if (connected.status === "ready")
      await assignUnconfiguredRoles(s.roleService, s.providerService);
  });
  handle("awenes:provider:verify", async (input) => {
    await s.providerService.verify(z.string().uuid().parse(input));
  });
  handle("awenes:provider:disconnect", async (input) => {
    await s.providerService.remove(z.string().uuid().parse(input));
  });
  handle("awenes:run:create", async (input) => {
    await s.workflowService.create(z.string().uuid().parse(input));
  });
  handle("awenes:run:details", async (input) => {
    const runId = z.string().uuid().parse(input);
    const run = await s.workflowService.get(runId);
    return {
      run,
      steps: await s.workflowService.steps(runId),
      approvals: await s.workflowService.approvals(runId),
      plans: await s.workflowService.plans(runId),
      interventions: await s.workflowService.interventions(runId),
      delivery: await s.deliveries.get(runId),
      browserEvidence: await s.browserService.evidence(runId),
      browserConfigured: await s.browserService.isConfigured(run.projectId),
    };
  });
  handle("awenes:run:action", async (input) => {
    const value = z
      .object({
        runId: z.string().uuid(),
        action: z.enum(["next", "pause", "resume", "cancel", "archive", "restore", "delete"]),
      })
      .parse(input);
    if (value.action === "archive" || value.action === "restore" || value.action === "delete") {
      await s.workflowService[value.action](value.runId);
    } else if (value.action === "next") {
      const result = await s.workflowEngine.executeNext(value.runId);
      if (result.status === "running" && result.currentStage === "delivery") {
        const project = await s.projects.get(result.projectId);
        const policy = await s.projects.executionPolicy(result.projectId);
        if (
          project.completionPolicy === "auto_push" &&
          !policy.requirePushApproval
        ) {
          const { task } = await s.taskService.taskSummary(result.taskId);
          await s.gitService.commit(result.id, `feat: complete ${task.title}`);
          await s.gitService.push(result.id);
        }
      }
    } else {
      const run = await s.workflowService.get(value.runId);
      const task = await s.taskService.taskSummary(run.taskId);
      if (value.action === "pause") {
        await s.workflowService.pause(value.runId);
        if (task.task.status === "in_progress") await s.taskService.pause(run.taskId);
      } else if (value.action === "resume") {
        if (task.task.status === "paused") await s.taskService.resume(run.taskId);
        await s.workflowService.resume(value.runId);
        void runAutomatically(value.runId, s);
      } else {
        await s.workflowService.cancel(value.runId);
        if (task.task.status === "in_progress") await s.taskService.pause(run.taskId);
      }
    }
  });
  handle("awenes:approval:decide", async (input) => {
    const value = z
      .object({ approvalId: z.string().uuid(), approved: z.boolean() })
      .parse(input);
    const approval = await s.workflowService.approval(value.approvalId);
    await s.workflowService.decide(value.approvalId, value.approved);
    if (
      value.approved &&
      (approval.kind === "start" || approval.kind === "plan")
    )
      void runAutomatically(approval.runId, s);
    if (value.approved && approval.kind === "push") {
      const run = await s.workflowService.get(approval.runId);
      const { task } = await s.taskService.taskSummary(run.taskId);
      await s.gitService.commit(run.id, `feat: complete ${task.title}`);
      await s.gitService.push(run.id);
    }
  });
  handle("awenes:git:review", async (input) =>
    s.gitService.review(z.string().uuid().parse(input)),
  );
  handle("awenes:git:commit", async (input) => {
    const value = z
      .object({ runId: z.string().uuid(), message: z.string() })
      .parse(input);
    await s.gitService.commit(value.runId, value.message);
  });
  handle("awenes:git:push", async (input) => {
    await s.gitService.push(z.string().uuid().parse(input));
  });
  handle("awenes:browser:suggest", async (input) => {
    const project = await s.projects.get(z.string().uuid().parse(input));
    return detectLocalBrowserSetup(project.repositoryRoot);
  });
  handle("awenes:browser:config", async (input) => {
    const { config } = z.object({ config: BrowserTestConfigSchema, confirmLocalhostAccess: z.literal(true) }).parse(input);
    await s.browserService.saveConfig(config);
    const policy = await s.projects.executionPolicy(config.projectId);
    const browserCommands = [
      config.startCommand,
      config.setupCommand?.command,
      config.cleanupCommand?.command,
    ].filter((command): command is string => Boolean(command));
    await s.projects.saveExecutionPolicy(config.projectId, {
      ...policy,
      networkAccess:
        policy.networkAccess === "none" ? "localhost" : policy.networkAccess,
      commandAllowlist: [
        ...new Set([...policy.commandAllowlist, ...browserCommands]),
      ],
    });
  });
  handle("awenes:browser:credential", async (input) => {
    const value = z
      .object({
        projectId: z.string().uuid(),
        key: z.string(),
        value: z.string(),
      })
      .parse(input);
    await s.browserService.saveCredential(
      value.projectId,
      value.key,
      value.value,
    );
  });
  handle("awenes:browser:run", async (input) => {
    const run = await s.workflowService.get(z.string().uuid().parse(input)),
      worktree = await s.projects.worktreeForTask(run.taskId);
    if (!worktree) throw new Error("Run has no worktree");
    return s.browserService.verify(run.id, run.projectId, worktree.path);
  });
  handle("awenes:browser:evidence", async (input) =>
    s.browserService.evidence(z.string().uuid().parse(input)),
  );
  handle("awenes:notification:action", async (input) => {
    const value = z
      .object({ key: z.string(), action: z.enum(["dismiss", "snooze"]) })
      .parse(input);
    if (value.action === "dismiss")
      await s.notificationService.dismiss(value.key);
    else await s.notificationService.snoozeFor(value.key, "1h");
  });
}

const automaticRuns = new Set<string>();
const executionOwner = `desktop:${process.pid}`;
async function assignUnconfiguredRoles(
  roles: AgentRoleService,
  providers: ProviderService,
) {
  const ready = (await providers.list()).find(
    (provider) => provider.status === "ready" && provider.models.length,
  );
  if (!ready) return;
  const defaultModel = ready.models[0];
  if (!defaultModel) return;
  for (const role of await roles.list()) {
    if (role.enabled && (!role.providerId || !role.modelId))
      await roles.assignModel(role.id, ready.id, defaultModel);
  }
}

async function runAutomatically(runId: string, services: Services) {
  if (automaticRuns.has(runId)) return;
  if (!(await services.workflowService.acquireExecution(runId, executionOwner)))
    return;
  automaticRuns.add(runId);
  try {
    for (;;) {
      const run = await services.workflowService.get(runId);
      if (run.status !== "running") return;
      if (
        !(await services.workflowService.acquireExecution(
          runId,
          executionOwner,
        ))
      )
        return;
      await services.workflowEngine.executeNext(runId);
    }
  } catch (error) {
    await services.workflowService.fail(runId, error);
  } finally {
    automaticRuns.delete(runId);
    await services.workflowService.releaseExecution(runId, executionOwner);
  }
}
function contentType(path: string) {
  return (
    (
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      } as Record<string, string>
    )[extname(path)] ?? "application/octet-stream"
  );
}
