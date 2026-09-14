const { contextBridge, ipcRenderer } =
  require("electron") as typeof import("electron");
import type { DesktopApi } from "./contracts.js";

let pendingOperations = 0;
const activityListeners = new Set<(pending: number) => void>();
function publishActivity() {
  for (const listener of activityListeners) listener(pendingOperations);
}
async function invoke<T>(channel: string, input?: unknown): Promise<T> {
  pendingOperations += 1;
  publishActivity();
  try {
    return await ipcRenderer.invoke(channel, input);
  } finally {
    pendingOperations = Math.max(0, pendingOperations - 1);
    publishActivity();
  }
}

const api: DesktopApi = {
  onActivity: (listener) => {
    activityListeners.add(listener);
    listener(pendingOperations);
    return () => activityListeners.delete(listener);
  },
  snapshot: () => invoke("awenes:snapshot"),
  selectProjectDirectory: () => invoke("awenes:project:select-directory"),
  addProject: (input) => invoke("awenes:project:add", input),
  captureTask: (input) => invoke("awenes:task:capture", input),
  taskAction: (input) => invoke("awenes:task:action", input),
  projectReadiness: (projectId) =>
    invoke("awenes:project:readiness", projectId),
  executionPolicy: (projectId) =>
    invoke("awenes:policy:get", projectId),
  saveExecutionPolicy: (input) =>
    invoke("awenes:policy:set", input),
  createRole: (input) => invoke("awenes:role:create", input),
  setRoleEnabled: (input) => invoke("awenes:role:enabled", input),
  connectProvider: (input) =>
    invoke("awenes:provider:connect", input),
  verifyProvider: (providerId) =>
    invoke("awenes:provider:verify", providerId),
  disconnectProvider: (providerId) =>
    invoke("awenes:provider:disconnect", providerId),
  assignRoleModel: (input) => invoke("awenes:role:model", input),
  promptDetails: (roleId) =>
    invoke("awenes:prompt:details", roleId),
  savePrompt: (input) => invoke("awenes:prompt:save", input),
  resetPrompt: (roleId) => invoke("awenes:prompt:reset", roleId),
  listSkills: (projectId) =>
    invoke("awenes:skills:list", projectId),
  saveSkill: (input) => invoke("awenes:skills:save", input),
  attachSkill: (input) => invoke("awenes:skills:attach", input),
  createRun: (taskId) => invoke("awenes:run:create", taskId),
  runDetails: (runId) => invoke("awenes:run:details", runId),
  runAction: (input) => invoke("awenes:run:action", input),
  decideApproval: (input) =>
    invoke("awenes:approval:decide", input),
  taskCompletion: (input) =>
    invoke("awenes:task:completion", input),
  taskSummary: (taskId) => invoke("awenes:task:summary", taskId),
  gitReview: (runId) => invoke("awenes:git:review", runId),
  gitCommit: (input) => invoke("awenes:git:commit", input),
  gitPush: (runId) => invoke("awenes:git:push", runId),
  saveBrowserConfig: (input) =>
    invoke("awenes:browser:config", input),
  saveBrowserCredential: (input) =>
    invoke("awenes:browser:credential", input),
  runBrowserTest: (runId) => invoke("awenes:browser:run", runId),
  browserEvidence: (runId) =>
    invoke("awenes:browser:evidence", runId),
  notificationAction: (input) =>
    invoke("awenes:notification:action", input),
};
contextBridge.exposeInMainWorld("awenes", api);
