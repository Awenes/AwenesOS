import {
  app,
  BrowserWindow,
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
import { ManualCrmAdapter } from "../src/infrastructure/crm/manual-crm-adapter.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { LocalEnvironmentInspector } from "../src/infrastructure/environment/local-environment-inspector.js";
import { GuardedCommandExecutor } from "../src/infrastructure/execution/guarded-command-executor.js";
import { WorktreeToolHost } from "../src/infrastructure/execution/worktree-tool-host.js";
import { LocalGitDeliveryDriver } from "../src/infrastructure/git/local-git-delivery-driver.js";
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
  const taskService = new TaskService(tasks, new ManualCrmAdapter(), "manual"),
    projectService = new ProjectService(
      projects,
      new LocalEnvironmentInspector(),
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
  registerIpc(mainWindow, {
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
  });
  await mainWindow.loadURL("awenes://app/index.html");
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
      roles,
      providers,
      runs,
      notifications,
      pendingCrm,
      pendingTracker,
    ] = await Promise.all([
      s.projectService.list(),
      s.taskService.allTasks(),
      s.roleService.list(),
      s.providerService.list(),
      s.workflowService.list(),
      s.notificationService.list(),
      s.taskService.pendingManualCrmUpdates(),
      s.taskService.pendingTrackerUpdates(),
    ]);
    const approvals = (
      await Promise.all(runs.map((run) => s.workflowService.approvals(run.id)))
    )
      .flat()
      .filter((value) => value.status === "pending");
    return {
      projects,
      tasks,
      roles,
      providers,
      runs,
      approvals,
      notifications,
      pendingCrm: pendingCrm.length,
      pendingTracker: pendingTracker.length,
    } satisfies DesktopSnapshot;
  });
  handle("awenes:project:add", async (input) => {
    const value = z
      .object({
        name: z.string(),
        repositoryRoot: z.string(),
        defaultBranch: z.string(),
        completionPolicy: CompletionPolicySchema,
      })
      .parse(input);
    await s.projectService.register(value);
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
        projectId: z.string().uuid().nullable(),
      })
      .parse(input);
    const task = await s.taskService.capture({
      title: value.title,
      source: value.source,
      assignmentDescription: value.description,
      assignedToMe: false,
      occurredAt: new Date(),
    });
    if (value.projectId)
      await s.taskService.assignProject(task.id, value.projectId, s.projects);
  });
  handle("awenes:task:action", async (input) => {
    const value = z
      .object({
        taskId: z.string().uuid(),
        action: z.enum(["claim", "start", "pause", "resume"]),
      })
      .parse(input);
    await s.taskService[value.action](value.taskId);
  });
  handle("awenes:task:summary", async (input) =>
    s.taskService.taskSummary(z.string().uuid().parse(input)),
  );
  handle("awenes:task:completion", async (input) => {
    const value = z
      .object({
        taskId: z.string().uuid(),
        action: z.enum(["prepare", "finish", "confirm_crm", "confirm_tracker"]),
        description: z.string().optional(),
      })
      .parse(input);
    if (value.action === "prepare")
      await s.taskService.prepareCompletion(value.taskId, value.description);
    else if (value.action === "finish")
      await s.taskService.complete(value.taskId);
    else if (value.action === "confirm_crm")
      await s.taskService.confirmManualCrmUpdate(value.taskId);
    else await s.taskService.confirmTrackerUpdate(value.taskId);
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
    await s.providerService.connect(
      ProviderConnectionInputSchema.parse(connection),
      apiKey,
    );
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
    return {
      run: await s.workflowService.get(runId),
      steps: await s.workflowService.steps(runId),
      approvals: await s.workflowService.approvals(runId),
      delivery: await s.deliveries.get(runId),
      browserEvidence: await s.browserService.evidence(runId),
    };
  });
  handle("awenes:run:action", async (input) => {
    const value = z
      .object({
        runId: z.string().uuid(),
        action: z.enum(["next", "pause", "resume", "cancel"]),
      })
      .parse(input);
    if (value.action === "next") {
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
    } else await s.workflowService[value.action](value.runId);
  });
  handle("awenes:approval:decide", async (input) => {
    const value = z
      .object({ approvalId: z.string().uuid(), approved: z.boolean() })
      .parse(input);
    const approval = await s.workflowService.approval(value.approvalId);
    await s.workflowService.decide(value.approvalId, value.approved);
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
  handle("awenes:browser:config", async (input) => {
    await s.browserService.saveConfig(BrowserTestConfigSchema.parse(input));
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
