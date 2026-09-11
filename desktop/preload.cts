const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");
import type { DesktopApi } from "./contracts.js";

const api: DesktopApi = {
  snapshot: () => ipcRenderer.invoke("awenes:snapshot"),
  addProject: (input) => ipcRenderer.invoke("awenes:project:add", input),
  captureTask: (input) => ipcRenderer.invoke("awenes:task:capture", input),
  taskAction: (input) => ipcRenderer.invoke("awenes:task:action", input),
  projectReadiness: (projectId) => ipcRenderer.invoke("awenes:project:readiness", projectId),
  executionPolicy: (projectId) => ipcRenderer.invoke("awenes:policy:get", projectId),
  saveExecutionPolicy: (input) => ipcRenderer.invoke("awenes:policy:set", input),
  createRole: (input) => ipcRenderer.invoke("awenes:role:create", input),
  setRoleEnabled: (input) => ipcRenderer.invoke("awenes:role:enabled", input)
};
contextBridge.exposeInMainWorld("awenes", api);
