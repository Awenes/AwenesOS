import type { SkillPermission } from "./instruction.js";

export interface SkillPermissionOption {
  id: SkillPermission;
  name: string;
  description: string;
}

export const SKILL_PERMISSIONS: readonly SkillPermissionOption[] = [
  { id: "read_repository", name: "Read repository", description: "Read files in the project's repository." },
  { id: "write_worktree", name: "Write worktree", description: "Write files inside the task's isolated worktree." },
  { id: "run_commands", name: "Run commands", description: "Execute allowlisted commands during a run." },
  { id: "localhost", name: "Localhost access", description: "Reach the project's local development server." },
  { id: "public_network", name: "Public network", description: "Reach the public internet." },
  { id: "browser", name: "Browser testing", description: "Drive the isolated browser profile." },
  { id: "git_commit", name: "Git commit", description: "Create commits in the task worktree." },
  { id: "git_push", name: "Git push", description: "Push commits, subject to the project's delivery policy." },
];
