import { createHash } from "node:crypto";
import {
  SkillSnapshotInputSchema,
  type SkillSnapshotInput,
} from "../domain/instruction.js";
import type { AgentRoleRepository } from "../infrastructure/repositories/agent-role-repository.js";
import type { InstructionRepository } from "../infrastructure/repositories/instruction-repository.js";

export class InstructionService {
  constructor(
    private readonly instructions: InstructionRepository,
    private readonly roles: AgentRoleRepository,
  ) {}
  async initializeRole(roleId: string) {
    const role = await this.roles.get(roleId);
    return this.instructions.ensurePrompt(roleId, role.promptTemplate);
  }
  async savePrompt(roleId: string, content: string) {
    await this.roles.get(roleId);
    const value = content.trim();
    if (!value) throw new Error("Prompt cannot be empty");
    return this.instructions.savePrompt(roleId, value);
  }
  async resetPrompt(roleId: string) {
    const role = await this.roles.get(roleId);
    return this.instructions.savePrompt(roleId, role.promptTemplate);
  }
  promptHistory(roleId: string) {
    return this.instructions.promptHistory(roleId);
  }
  saveSkill(input: SkillSnapshotInput) {
    return this.instructions.saveSkill(SkillSnapshotInputSchema.parse(input));
  }
  listSkills(projectId?: string) {
    return this.instructions.listSkills(projectId);
  }
  async attachSkill(roleId: string, skillId: string) {
    await this.roles.get(roleId);
    const skill = await this.instructions.getSkill(skillId);
    if (!skill.reviewed)
      throw new Error("Review the skill permissions before attaching it");
    await this.instructions.attach(roleId, skillId);
  }
  detachSkill(roleId: string, skillId: string) {
    return this.instructions.detach(roleId, skillId);
  }
  async effective(roleId: string) {
    const role = await this.roles.get(roleId);
    const prompt = await this.instructions.ensurePrompt(
      roleId,
      role.promptTemplate,
    );
    const skills = await this.instructions.skillsForRole(roleId);
    const warnings = conflicts(
      prompt.content,
      skills.map((skill) => skill.content),
    );
    const content = [
      prompt.content,
      ...skills.map(
        (skill) =>
          `\n## Skill: ${skill.name} (${skill.version}, sha256:${skill.contentHash})\n${skill.content}`,
      ),
    ].join("\n");
    return {
      roleId,
      prompt,
      skills,
      content,
      warnings,
      contentHash: createHash("sha256").update(content).digest("hex"),
    };
  }
  async initializeBuiltIns() {
    for (const skill of BUILT_IN_SKILLS)
      await this.instructions.saveSkill(SkillSnapshotInputSchema.parse(skill));
  }
}
const BUILT_IN_SKILLS: SkillSnapshotInput[] = [
  {
    projectId: null,
    source: "built_in",
    slug: "safe-implementation",
    name: "Safe implementation",
    version: "1.0.0",
    content:
      "Inspect the relevant code and tests first. Make the smallest coherent change in the assigned worktree. Validate boundary inputs and preserve existing behavior unless the task requires a change.",
    permissions: ["read_repository", "write_worktree", "run_commands"],
    reviewed: true,
  },
  {
    projectId: null,
    source: "built_in",
    slug: "evidence-driven-review",
    name: "Evidence-driven review",
    version: "1.0.0",
    content:
      "Review the resulting diff for correctness, regressions, security boundaries, and missing tests. Report concrete evidence and do not declare success when a required check failed.",
    permissions: ["read_repository", "run_commands"],
    reviewed: true,
  },
  {
    projectId: null,
    source: "built_in",
    slug: "localhost-browser-check",
    name: "Localhost browser check",
    version: "1.0.0",
    content:
      "Use only the configured localhost application and isolated browser profile. Capture assertions, screenshots, traces, console errors, and failed requests as completion evidence.",
    permissions: ["localhost", "browser", "run_commands"],
    reviewed: true,
  },
];
function conflicts(prompt: string, skills: string[]) {
  const text = [prompt, ...skills].join("\n").toLowerCase();
  const warnings: string[] = [];
  if (text.includes("never push") && text.includes("git push"))
    warnings.push("Instructions both prohibit and request Git push.");
  if (text.includes("no network") && text.includes("public network"))
    warnings.push("Instructions contain conflicting network requirements.");
  return warnings;
}
