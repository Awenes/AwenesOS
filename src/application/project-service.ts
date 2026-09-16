import { resolve } from "node:path";
import { ExecutionPolicySchema, RegisterProjectSchema, type CompletionPolicy, type EnvironmentInspector, type ExecutionPolicy, type GitRepositoryInitializer, type RegisterProject } from "../domain/project.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";

export class ProjectService {
  constructor(private readonly repository: ProjectRepository, private readonly inspector: EnvironmentInspector, private readonly git?: GitRepositoryInitializer) {}

  async register(input: RegisterProject & { initializeGit?: boolean }) {
    const parsed = RegisterProjectSchema.parse({ ...input, repositoryRoot: resolve(input.repositoryRoot) });
    if (this.git && !(await this.git.isRepository(parsed.repositoryRoot))) {
      if (!input.initializeGit) throw new Error("This folder is not a Git repository. Choose ‘Create a local Git repository’ to continue.");
      await this.git.initialize(parsed.repositoryRoot, parsed.defaultBranch);
    }
    return this.repository.create(parsed);
  }

  list() { return this.repository.list(); }

  async readiness(id: string) {
    const [project, policy] = await Promise.all([this.repository.get(id), this.repository.executionPolicy(id)]);
    return this.inspector.inspect(project, policy);
  }

  async setCompletionPolicy(id: string, completionPolicy: CompletionPolicy) {
    return this.repository.setCompletionPolicy(id, completionPolicy);
  }

  executionPolicy(id: string) { return this.repository.executionPolicy(id); }
  setExecutionPolicy(id: string, policy: ExecutionPolicy) { return this.repository.saveExecutionPolicy(id, ExecutionPolicySchema.parse(policy)); }
}
