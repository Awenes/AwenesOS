import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { PromptVersion, SkillSnapshot, SkillSnapshotInput } from "../../domain/instruction.js";
import type { Database } from "../db/database.js";
import { rolePromptVersions, roleSkillSnapshots, skillSnapshots } from "../db/schema.js";

export class InstructionRepository {
  constructor(private readonly db: Database) {}
  async ensurePrompt(roleId: string, content: string) { return await this.latestPrompt(roleId) ?? this.savePrompt(roleId, content); }
  async savePrompt(roleId: string, content: string): Promise<PromptVersion> { const latest=await this.latestPrompt(roleId); const value={id:randomUUID(),roleId,version:(latest?.version??0)+1,content,createdAt:new Date()}; await this.db.insert(rolePromptVersions).values(value); return value; }
  async latestPrompt(roleId: string): Promise<PromptVersion|null> { const row=await this.db.query.rolePromptVersions.findFirst({where:eq(rolePromptVersions.roleId,roleId),orderBy:[desc(rolePromptVersions.version)]}); return row??null; }
  async promptHistory(roleId:string){return this.db.select().from(rolePromptVersions).where(eq(rolePromptVersions.roleId,roleId)).orderBy(desc(rolePromptVersions.version));}
  async saveSkill(input: SkillSnapshotInput): Promise<SkillSnapshot> { const contentHash=createHash("sha256").update(input.content).digest("hex"); const existing=await this.db.query.skillSnapshots.findFirst({where:eq(skillSnapshots.contentHash,contentHash)}); if(existing)return existing as SkillSnapshot; const value={id:randomUUID(),...input,contentHash,createdAt:new Date()}; await this.db.insert(skillSnapshots).values(value); return value; }
  async getSkill(id:string){const row=await this.db.query.skillSnapshots.findFirst({where:eq(skillSnapshots.id,id)});if(!row)throw new Error(`Skill snapshot not found: ${id}`);return row as SkillSnapshot;}
  async listSkills(projectId?:string){const rows=await this.db.select().from(skillSnapshots).orderBy(asc(skillSnapshots.name),desc(skillSnapshots.createdAt));return rows.filter(row=>row.projectId===null||!projectId||row.projectId===projectId) as SkillSnapshot[];}
  async attach(roleId:string,skillSnapshotId:string){await this.db.insert(roleSkillSnapshots).values({roleId,skillSnapshotId,attachedAt:new Date()}).onConflictDoNothing();}
  async detach(roleId:string,skillSnapshotId:string){await this.db.delete(roleSkillSnapshots).where(and(eq(roleSkillSnapshots.roleId,roleId),eq(roleSkillSnapshots.skillSnapshotId,skillSnapshotId)));}
  async skillsForRole(roleId:string){const links=await this.db.select().from(roleSkillSnapshots).where(eq(roleSkillSnapshots.roleId,roleId)).orderBy(asc(roleSkillSnapshots.attachedAt));return Promise.all(links.map(link=>this.getSkill(link.skillSnapshotId)));}
}
