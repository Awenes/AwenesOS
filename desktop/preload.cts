const { contextBridge, ipcRenderer } =
  require("electron") as typeof import("electron");
import type { DesktopApi } from "./contracts.js";

let pendingOperations = 0;
const activityListeners = new Set<(pending: number) => void>();
const feedbackListeners = new Set<(feedback: { message: string; tone: "success" | "error" }) => void>();
const successMessages: Record<string, string> = {
  "awenes:project:add": "Project added",
  "awenes:task:capture": "Task started",
  "awenes:task:action": "Task updated",
  "awenes:task:completion": "Completion status updated",
  "awenes:provider:connect": "Provider connection saved",
  "awenes:provider:verify": "Provider verified",
  "awenes:provider:disconnect": "Provider removed",
  "awenes:role:create": "Agent created",
  "awenes:role:enabled": "Agent availability updated",
  "awenes:role:model": "Agent model updated",
  "awenes:prompt:save": "Prompt version saved",
  "awenes:prompt:reset": "Prompt reset",
  "awenes:policy:set": "Safety settings saved",
  "awenes:approval:decide": "Decision recorded",
  "awenes:run:action": "Workflow updated",
  "awenes:git:review": "Diff review refreshed",
  "awenes:git:commit": "Changes committed",
  "awenes:git:push": "Changes pushed",
  "awenes:browser:config": "Browser validation configured",
  "awenes:browser:run": "Browser validation finished",
  "awenes:data:export": "AwenesOS data exported",
};
function publishActivity() {
  for (const listener of activityListeners) listener(pendingOperations);
}
async function invoke<T>(channel: string, input?: unknown): Promise<T> {
  pendingOperations += 1;
  publishActivity();
  try {
    const result = await ipcRenderer.invoke(channel, input);
    const message = successMessages[channel];
    if (message) for (const listener of feedbackListeners) listener({ message, tone: "success" });
    return result;
  } catch (error) {
    for (const listener of feedbackListeners) listener({ message: error instanceof Error ? error.message : String(error), tone: "error" });
    throw error;
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
  onFeedback: (listener) => {
    feedbackListeners.add(listener);
    return () => feedbackListeners.delete(listener);
  },
  snapshot: () => invoke("awenes:snapshot"),
  exportData: () => invoke("awenes:data:export"),
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
  taskCompletionDraft: (taskId) =>
    invoke("awenes:task:completion-draft", taskId),
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
