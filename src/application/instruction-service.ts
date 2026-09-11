import { createHash } from "node:crypto";
import { SkillSnapshotInputSchema, type SkillSnapshotInput } from "../domain/instruction.js";
import type { AgentRoleRepository } from "../infrastructure/repositories/agent-role-repository.js";
import type { InstructionRepository } from "../infrastructure/repositories/instruction-repository.js";

export class InstructionService {
  constructor(private readonly instructions:InstructionRepository,private readonly roles:AgentRoleRepository){}
  async initializeRole(roleId:string){const role=await this.roles.get(roleId);return this.instructions.ensurePrompt(roleId,role.promptTemplate);}
  async savePrompt(roleId:string,content:string){await this.roles.get(roleId);const value=content.trim();if(!value)throw new Error("Prompt cannot be empty");return this.instructions.savePrompt(roleId,value);}
  promptHistory(roleId:string){return this.instructions.promptHistory(roleId);}
  saveSkill(input:SkillSnapshotInput){return this.instructions.saveSkill(SkillSnapshotInputSchema.parse(input));}
  listSkills(projectId?:string){return this.instructions.listSkills(projectId);}
  async attachSkill(roleId:string,skillId:string){await this.roles.get(roleId);const skill=await this.instructions.getSkill(skillId);if(!skill.reviewed)throw new Error("Review the skill permissions before attaching it");await this.instructions.attach(roleId,skillId);}
  detachSkill(roleId:string,skillId:string){return this.instructions.detach(roleId,skillId);}
  async effective(roleId:string){const role=await this.roles.get(roleId);const prompt=await this.instructions.ensurePrompt(roleId,role.promptTemplate);const skills=await this.instructions.skillsForRole(roleId);const warnings=conflicts(prompt.content,skills.map(skill=>skill.content));const content=[prompt.content,...skills.map(skill=>`\n## Skill: ${skill.name} (${skill.version}, sha256:${skill.contentHash})\n${skill.content}`)].join("\n");return{roleId,prompt,skills,content,warnings,contentHash:createHash("sha256").update(content).digest("hex")};}
}
function conflicts(prompt:string,skills:string[]){const text=[prompt,...skills].join("\n").toLowerCase();const warnings:string[]=[];if(text.includes("never push")&&text.includes("git push"))warnings.push("Instructions both prohibit and request Git push.");if(text.includes("no network")&&text.includes("public network"))warnings.push("Instructions contain conflicting network requirements.");return warnings;}
