import { randomUUID } from "node:crypto";
import { and, asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import {
  AgentCapabilitySchema,
  RoleLimitsSchema,
  type AgentRole,
  type AgentRoleInput,
} from "../../domain/agent-role.js";
import type { Database } from "../db/database.js";
import { agentRoleEvents, agentRoles } from "../db/schema.js";
const AssignModelInputSchema = z.object({
  providerId: z.string().trim().min(1).max(80),
  modelId: z.string().trim().min(1).max(120),
});

export class AgentRoleRepository {
  constructor(private readonly db: Database) {}

  async ensureBuiltIn(input: AgentRoleInput): Promise<AgentRole> {
    const existing = await this.byScopeAndSlug("global", input.slug); return existing ?? this.create(input, true);
  }

  async create(input: AgentRoleInput, builtIn: boolean): Promise<AgentRole> {
    const now = new Date(); const role: AgentRole = { id: randomUUID(), ...input, builtIn, createdAt: now, updatedAt: now };
    await this.db.insert(agentRoles).values({ ...role, scopeKey: input.projectId ?? "global" });
    await this.event(role.id, "agent_role.created", { slug: role.slug, projectId: role.projectId, builtIn }, now); return role;
  }

  async get(id: string): Promise<AgentRole> { const row = await this.db.query.agentRoles.findFirst({ where: eq(agentRoles.id, id) }); if (!row) throw new Error(`Agent role not found: ${id}`); return fromRow(row); }
  async list(projectId?: string): Promise<AgentRole[]> {
    const where = projectId ? or(eq(agentRoles.scopeKey, "global"), eq(agentRoles.scopeKey, projectId)) : undefined;
    return (await this.db.select().from(agentRoles).where(where).orderBy(asc(agentRoles.scopeKey), asc(agentRoles.name))).map(fromRow);
  }
  async assignModel(id: string, providerId: string, modelId: string): Promise<AgentRole> {
    const parsed = AssignModelInputSchema.parse({ providerId, modelId }); const now = new Date();
    await this.db.update(agentRoles).set({ providerId: parsed.providerId, modelId: parsed.modelId, updatedAt: now }).where(eq(agentRoles.id, id)); await this.event(id, "agent_role.model_assigned", { providerId: parsed.providerId, modelId: parsed.modelId }, now); return this.get(id);
  }
  async setEnabled(id: string, enabled: boolean): Promise<AgentRole> {
    await this.get(id); const now = new Date(); await this.db.update(agentRoles).set({ enabled, updatedAt: now }).where(eq(agentRoles.id, id)); await this.event(id, enabled ? "agent_role.enabled" : "agent_role.disabled", {}, now); return this.get(id);
  }
  history(roleId: string) { return this.db.select().from(agentRoleEvents).where(eq(agentRoleEvents.roleId, roleId)).orderBy(asc(agentRoleEvents.occurredAt)); }
  private async byScopeAndSlug(scopeKey: string, slug: string) { const row = await this.db.query.agentRoles.findFirst({ where: and(eq(agentRoles.scopeKey, scopeKey), eq(agentRoles.slug, slug)) }); return row ? fromRow(row) : null; }
  private async event(roleId: string, type: string, data: Record<string, unknown>, occurredAt = new Date()) { await this.db.insert(agentRoleEvents).values({ id: randomUUID(), roleId, type, data, occurredAt }); }
}

function fromRow(row: typeof agentRoles.$inferSelect): AgentRole {
  const { scopeKey: _scopeKey, capabilities, limits, ...rest } = row;
  return {
    ...rest,
    capabilities: z.array(AgentCapabilitySchema).min(1).parse(capabilities),
    limits: RoleLimitsSchema.parse(limits),
  };
}
