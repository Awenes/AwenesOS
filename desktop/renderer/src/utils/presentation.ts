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
    overview: "Command Center",
    projects: "Projects",
    tasks: "Task Workspace",
    runs: "Workflow Runs",
    approvals: "Approval Inbox",
    agents: "Agent Roles",
    providers: "Model Providers",
    notifications: "Notifications",
    safety: "Safety and Permissions",
  }[view];
}

export function viewDescription(view: View) {
  return {
    overview: "Monitor projects, active work, agent runs, and decisions from one place.",
    projects: "Connect repositories and choose how each project should be delivered.",
    tasks: "Capture work, assign a project, and move tasks through delivery.",
    runs: "Inspect agent progress, evidence, validation, and delivery history.",
    approvals: "Review plans and protected actions waiting for your decision.",
    agents: "Shape agent responsibilities, instructions, skills, and model assignments.",
    providers: "Manage the model connections available to your agents.",
    notifications: "Review important workflow changes and items needing attention.",
    safety: "Control project access, commands, network boundaries, and browser testing.",
  }[view];
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function readinessGuidance(name: string) {
  return (
    {
      repository: "Confirm the folder path is correct and that this account can read and write it, then select Check project setup again.",
      git: "Install Git and make sure it is on your PATH, then select Check project setup again.",
      node: "Install Node.js 22 or later and make sure it is on your PATH, then select Check project setup again.",
      pnpm: "Install pnpm — for example, run \"npm install -g pnpm\" in a terminal — and make sure it is on your PATH, then select Check project setup again.",
      worktree: "Confirm this folder is a Git repository that supports worktrees, then select Check project setup again.",
      browser: "Install Google Chrome or Microsoft Edge to enable isolated localhost browser testing.",
    }[name] ?? "Resolve this outside AwenesOS, then select Check project setup again."
  );
}
