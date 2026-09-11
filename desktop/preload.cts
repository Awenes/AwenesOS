const { contextBridge, ipcRenderer } =
  require("electron") as typeof import("electron");
import type { DesktopApi } from "./contracts.js";

const api: DesktopApi = {
  snapshot: () => ipcRenderer.invoke("awenes:snapshot"),
  addProject: (input) => ipcRenderer.invoke("awenes:project:add", input),
  captureTask: (input) => ipcRenderer.invoke("awenes:task:capture", input),
  taskAction: (input) => ipcRenderer.invoke("awenes:task:action", input),
  projectReadiness: (projectId) =>
    ipcRenderer.invoke("awenes:project:readiness", projectId),
  executionPolicy: (projectId) =>
    ipcRenderer.invoke("awenes:policy:get", projectId),
  saveExecutionPolicy: (input) =>
    ipcRenderer.invoke("awenes:policy:set", input),
  createRole: (input) => ipcRenderer.invoke("awenes:role:create", input),
  setRoleEnabled: (input) => ipcRenderer.invoke("awenes:role:enabled", input),
  connectProvider: (input) =>
    ipcRenderer.invoke("awenes:provider:connect", input),
  verifyProvider: (providerId) =>
    ipcRenderer.invoke("awenes:provider:verify", providerId),
  disconnectProvider: (providerId) =>
    ipcRenderer.invoke("awenes:provider:disconnect", providerId),
  assignRoleModel: (input) => ipcRenderer.invoke("awenes:role:model", input),
  promptDetails: (roleId) =>
    ipcRenderer.invoke("awenes:prompt:details", roleId),
  savePrompt: (input) => ipcRenderer.invoke("awenes:prompt:save", input),
  resetPrompt: (roleId) => ipcRenderer.invoke("awenes:prompt:reset", roleId),
  listSkills: (projectId) =>
    ipcRenderer.invoke("awenes:skills:list", projectId),
  saveSkill: (input) => ipcRenderer.invoke("awenes:skills:save", input),
  attachSkill: (input) => ipcRenderer.invoke("awenes:skills:attach", input),
  createRun: (taskId) => ipcRenderer.invoke("awenes:run:create", taskId),
  runDetails: (runId) => ipcRenderer.invoke("awenes:run:details", runId),
  runAction: (input) => ipcRenderer.invoke("awenes:run:action", input),
  decideApproval: (input) =>
    ipcRenderer.invoke("awenes:approval:decide", input),
  taskCompletion: (input) =>
    ipcRenderer.invoke("awenes:task:completion", input),
  taskSummary: (taskId) => ipcRenderer.invoke("awenes:task:summary", taskId),
  gitReview: (runId) => ipcRenderer.invoke("awenes:git:review", runId),
  gitCommit: (input) => ipcRenderer.invoke("awenes:git:commit", input),
  gitPush: (runId) => ipcRenderer.invoke("awenes:git:push", runId),
  saveBrowserConfig: (input) =>
    ipcRenderer.invoke("awenes:browser:config", input),
  saveBrowserCredential: (input) =>
    ipcRenderer.invoke("awenes:browser:credential", input),
  runBrowserTest: (runId) => ipcRenderer.invoke("awenes:browser:run", runId),
  browserEvidence: (runId) =>
    ipcRenderer.invoke("awenes:browser:evidence", runId),
  notificationAction: (input) =>
    ipcRenderer.invoke("awenes:notification:action", input),
};
contextBridge.exposeInMainWorld("awenes", api);
