import { join } from "node:path";
import {
  BrowserTestConfigSchema,
  type BrowserTestConfig,
  type BrowserTestEvidence,
} from "../domain/browser-test.js";
import type { ManagedCommandExecutor } from "../domain/execution.js";
import type { SecretVault } from "../domain/provider.js";
import type { BrowserTestRepository } from "../infrastructure/repositories/browser-test-repository.js";
import type { ProjectRepository } from "../infrastructure/repositories/project-repository.js";
export interface BrowserAutomation {
  verify(input: {
    config: BrowserTestConfig;
    worktreePath: string;
    outputDirectory: string;
    credentials: Record<string, string>;
    commands: ManagedCommandExecutor;
  }): Promise<Omit<BrowserTestEvidence, "id" | "runId" | "createdAt">>;
}
export class BrowserTestService {
  constructor(
    private repository: BrowserTestRepository,
    private projects: ProjectRepository,
    private vault: SecretVault,
    private automation: BrowserAutomation,
    private commandFactory: (
      root: string,
      projectId: string,
    ) => Promise<ManagedCommandExecutor>,
    private outputRoot: string,
  ) {}
  saveConfig(input: BrowserTestConfig) {
    return this.repository.saveConfig(BrowserTestConfigSchema.parse(input));
  }
  async isConfigured(projectId: string) {
    return Boolean(await this.repository.config(projectId));
  }
  async saveCredential(projectId: string, key: string, value: string) {
    await this.projects.get(projectId);
    if (!key.trim() || !value)
      throw new Error("Credential name and value are required");
    await this.vault.set(`browser:${projectId}:${key.trim()}`, value);
  }
  async verify(runId: string, projectId: string, worktreePath: string) {
    const config = await this.repository.config(projectId);
    if (!config) throw new Error("Configure browser testing first");
    const policy = await this.projects.executionPolicy(projectId);
    if (policy.networkAccess === "none")
      throw new Error("Grant localhost network access before browser testing");
    const credentials: Record<string, string> = {};
    for (const key of config.credentialKeys) {
      const value = await this.vault.get(`browser:${projectId}:${key}`);
      if (!value) throw new Error(`Missing browser test credential: ${key}`);
      credentials[key] = value;
    }
    const evidence = await this.automation.verify({
      config,
      worktreePath,
      outputDirectory: join(this.outputRoot, runId, "browser"),
      credentials,
      commands: await this.commandFactory(worktreePath, projectId),
    });
    return this.repository.saveEvidence({ runId, ...evidence });
  }
  evidence(runId: string) {
    return this.repository.evidence(runId);
  }
}
