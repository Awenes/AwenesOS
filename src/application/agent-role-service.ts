import { AgentRoleInputSchema, builtInAgentRoles, type AgentRoleInput } from "../domain/agent-role.js";
import type { AgentRoleRepository } from "../infrastructure/repositories/agent-role-repository.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";

export class AgentRoleService {
  constructor(private readonly roles: AgentRoleRepository, private readonly projects: ProjectRepository) {}

  async initializeBuiltIns() { for (const role of builtInAgentRoles) await this.roles.ensureBuiltIn(role); }
  async create(input: AgentRoleInput) { const parsed = AgentRoleInputSchema.parse(input); if (parsed.projectId) await this.projects.get(parsed.projectId); return this.roles.create(parsed, false); }
  list(projectId?: string) { return this.roles.list(projectId); }
  get(id: string) { return this.roles.get(id); }
  async assignModel(id: string, providerId: string, modelId: string) { return this.roles.assignModel(id, providerId.trim(), modelId.trim()); }
  setEnabled(id: string, enabled: boolean) { return this.roles.setEnabled(id, enabled); }
}
