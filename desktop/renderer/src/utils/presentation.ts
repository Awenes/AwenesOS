import type { DesktopSnapshot } from "../../../contracts.js";

export type View =
  | "overview"
  | "projects"
  | "tasks"
  | "runs"
  | "approvals"
  | "agents"
  | "providers"
  | "notifications"
  | "safety";

export const navigation: ReadonlyArray<readonly [View, string]> = [
  ["overview", "Overview"],
  ["projects", "Projects"],
  ["tasks", "Tasks"],
  ["runs", "Runs"],
  ["approvals", "Approvals"],
  ["agents", "Agents"],
  ["providers", "Providers"],
  ["notifications", "Notifications"],
  ["safety", "Safety"],
];

export function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function projectName(data: DesktopSnapshot, id: string | null) {
  return data.projects.find((project) => project.id === id)?.name ?? "Unassigned";
}

export function taskName(data: DesktopSnapshot, id: string) {
  return [...data.tasks, ...data.archivedTasks].find((task) => task.id === id)?.title ?? "Unknown task";
}

export function formatCheckedAt(value: Date | string) {
  const checkedAt = new Date(value);
  if (Number.isNaN(checkedAt.getTime())) return "successfully";
  return checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function splitCommaSeparated(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function folderName(path: string) {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) ?? path;
}

export function viewTitle(view: View) {
  return {
    overview: "Command center",
    projects: "Projects",
    tasks: "Task workspace",
    runs: "Workflow runs",
    approvals: "Approval inbox",
    agents: "Agent roles",
    providers: "Model providers",
    notifications: "Notifications",
    safety: "Safety and permissions",
  }[view];
}

export function viewIcon(view: View) {
  return {
    overview: "⌂",
    projects: "▦",
    tasks: "✓",
    runs: "▶",
    approvals: "!",
    agents: "◎",
    providers: "◉",
    notifications: "◌",
    safety: "◈",
  }[view];
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
