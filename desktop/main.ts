import { app, BrowserWindow, ipcMain, protocol, session } from "electron";
import { extname, join, normalize, resolve, sep } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { DesktopSnapshot } from "./contracts.js";
import { AgentRoleService } from "../src/application/agent-role-service.js";
import { ProjectService } from "../src/application/project-service.js";
import { TaskService } from "../src/application/task-service.js";
import { ProviderService } from "../src/application/provider-service.js";
import { AgentRoleInputSchema } from "../src/domain/agent-role.js";
import { CompletionPolicySchema, ExecutionPolicySchema } from "../src/domain/project.js";
import { TaskSourceSchema } from "../src/domain/task.js";
import { ProviderConnectionInputSchema } from "../src/domain/provider.js";
import { ManualCrmAdapter } from "../src/infrastructure/crm/manual-crm-adapter.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { LocalEnvironmentInspector } from "../src/infrastructure/environment/local-environment-inspector.js";
import { AgentRoleRepository } from "../src/infrastructure/repositories/agent-role-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { ProviderRepository } from "../src/infrastructure/repositories/provider-repository.js";
import { LocalProviderProbe } from "../src/infrastructure/providers/local-provider-probe.js";
import { EncryptedSecretVault } from "./encrypted-secret-vault.js";

protocol.registerSchemesAsPrivileged([{ scheme: "awenes", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let mainWindow: BrowserWindow | null = null;

void app.whenReady().then(start).catch((error) => { console.error(error); app.quit(); });
app.on("window-all-closed", () => app.quit());

async function start() {
  const rendererRoot = resolve(app.getAppPath(), "dist-desktop", "renderer");
  protocol.handle("awenes", async (request) => {
    const requested = normalize(new URL(request.url).pathname.replace(/^\//, "") || "index.html");
    const file = resolve(rendererRoot, requested);
    if (file !== rendererRoot && !file.startsWith(`${rendererRoot}${sep}`)) return new Response("Not found", { status: 404 });
    try {
      return new Response(new Uint8Array(await readFile(file)), { headers: { "content-type": contentType(file) } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  const databasePath = process.env.AWENES_DB_PATH || (app.isPackaged ? join(app.getPath("userData"), "awenes.db") : "./data/awenes.db");
  const opened = await openDatabase(databasePath);
  const taskRepository = new TaskRepository(opened.db);
  const projectRepository = new ProjectRepository(opened.db);
  const roleRepository = new AgentRoleRepository(opened.db);
  const providerRepository = new ProviderRepository(opened.db);
  const taskService = new TaskService(taskRepository, new ManualCrmAdapter(), "manual");
  const projectService = new ProjectService(projectRepository, new LocalEnvironmentInspector());
  const roleService = new AgentRoleService(roleRepository, projectRepository);
  const providerService = new ProviderService(providerRepository, new EncryptedSecretVault(join(app.getPath("userData"), "secrets.json")), new LocalProviderProbe());
  await roleService.initializeBuiltIns();
  app.on("before-quit", () => { opened.client.close(); });

  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1040, minHeight: 680, show: true,
    backgroundColor: "#0b1020",
    webPreferences: { preload: join(app.getAppPath(), "dist-desktop", "main", "desktop", "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("awenes://")) event.preventDefault(); });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpc(mainWindow, { projectService, taskService, roleService, providerService, projectRepository });
  await mainWindow.loadURL("awenes://app/index.html");
  const captureArgument = process.argv.find((argument) => argument.startsWith("capture="));
  const capturePath = captureArgument?.slice("capture=".length);
  if (capturePath) {
    mainWindow.webContents.debugger.attach("1.3");
    const result = await mainWindow.webContents.debugger.sendCommand("Page.captureScreenshot", { format: "png" }) as { data: string };
    mainWindow.webContents.debugger.detach();
    await writeFile(resolve(capturePath), Buffer.from(result.data, "base64"));
    app.quit();
  }
}

function registerIpc(window: BrowserWindow, services: { projectService: ProjectService; taskService: TaskService; roleService: AgentRoleService; providerService: ProviderService; projectRepository: ProjectRepository }) {
  const { projectService, taskService, roleService, providerService, projectRepository } = services;
  const trusted = (sender: Electron.WebContents) => sender === window.webContents && sender.getURL().startsWith("awenes://app/");
  const handle = <T>(channel: string, operation: (input: unknown) => Promise<T>) => ipcMain.handle(channel, async (event, input) => {
    if (!trusted(event.sender)) throw new Error("Untrusted desktop request"); return operation(input);
  });

  handle("awenes:snapshot", async () => {
    const [projects, tasks, roles, providers, pendingCrm, pendingTracker] = await Promise.all([projectService.list(), taskService.allTasks(), roleService.list(), providerService.list(), taskService.pendingManualCrmUpdates(), taskService.pendingTrackerUpdates()]);
    return { projects, tasks, roles, providers, pendingCrm: pendingCrm.length, pendingTracker: pendingTracker.length } satisfies DesktopSnapshot;
  });
  handle("awenes:project:add", async (input) => { const value = z.object({ name: z.string(), repositoryRoot: z.string(), defaultBranch: z.string(), completionPolicy: CompletionPolicySchema }).parse(input); await projectService.register(value); });
  handle("awenes:task:capture", async (input) => { const value = z.object({ title: z.string(), source: TaskSourceSchema, description: z.string(), projectId: z.string().uuid().nullable() }).parse(input); const task = await taskService.capture({ title: value.title, source: value.source, assignmentDescription: value.description, assignedToMe: false, occurredAt: new Date() }); if (value.projectId) await taskService.assignProject(task.id, value.projectId, projectRepository); });
  handle("awenes:task:action", async (input) => { const value = z.object({ taskId: z.string().uuid(), action: z.enum(["claim", "start", "pause", "resume"]) }).parse(input); await taskService[value.action](value.taskId); });
  handle("awenes:project:readiness", async (input) => projectService.readiness(z.string().uuid().parse(input)));
  handle("awenes:policy:get", async (input) => projectService.executionPolicy(z.string().uuid().parse(input)));
  handle("awenes:policy:set", async (input) => { const value = z.object({ projectId: z.string().uuid(), policy: ExecutionPolicySchema }).parse(input); await projectService.setExecutionPolicy(value.projectId, value.policy); });
  handle("awenes:role:create", async (input) => { await roleService.create(AgentRoleInputSchema.parse(input)); });
  handle("awenes:role:enabled", async (input) => { const value = z.object({ roleId: z.string().uuid(), enabled: z.boolean() }).parse(input); await roleService.setEnabled(value.roleId, value.enabled); });
  handle("awenes:provider:connect", async (input) => { const value = z.object({ name: z.string(), kind: z.string(), authMethod: z.string(), command: z.string().nullable(), models: z.array(z.string()), apiKey: z.string().optional() }).parse(input); const { apiKey, ...connection } = value; await providerService.connect(ProviderConnectionInputSchema.parse(connection), apiKey); });
  handle("awenes:provider:verify", async (input) => { await providerService.verify(z.string().uuid().parse(input)); });
  handle("awenes:provider:disconnect", async (input) => { await providerService.remove(z.string().uuid().parse(input)); });
}

function contentType(path: string) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" } as Record<string, string>)[extname(path)] ?? "application/octet-stream";
}
