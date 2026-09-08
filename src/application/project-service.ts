import { resolve } from "node:path";
import { ExecutionPolicySchema, RegisterProjectSchema, type CompletionPolicy, type EnvironmentInspector, type ExecutionPolicy, type RegisterProject } from "../domain/project.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";

export class ProjectService {
  constructor(private readonly repository: ProjectRepository, private readonly inspector: EnvironmentInspector) {}

  async register(input: RegisterProject) {
    const parsed = RegisterProjectSchema.parse({ ...input, repositoryRoot: resolve(input.repositoryRoot) });
    return this.repository.create(parsed);
  }

  list() { return this.repository.list(); }

  async readiness(id: string) { return this.inspector.inspect(await this.repository.get(id)); }

  async setCompletionPolicy(id: string, completionPolicy: CompletionPolicy) {
    return this.repository.setCompletionPolicy(id, completionPolicy);
  }

  executionPolicy(id: string) { return this.repository.executionPolicy(id); }
  setExecutionPolicy(id: string, policy: ExecutionPolicy) { return this.repository.saveExecutionPolicy(id, ExecutionPolicySchema.parse(policy)); }
}
