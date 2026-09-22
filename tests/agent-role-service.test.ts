import { describe, expect, it } from "vitest";
import { AgentRoleService } from "../src/application/agent-role-service.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { AgentRoleRepository } from "../src/infrastructure/repositories/agent-role-repository.js";
import { ProjectRepository } from "../src/infrastructure/repositories/project-repository.js";
import { ProviderRepository } from "../src/infrastructure/repositories/provider-repository.js";

describe("agent role service", () => {
  it("seeds the four provider-neutral built-in roles idempotently", async () => {
    const opened = await openDatabase(":memory:"); const repository = new AgentRoleRepository(opened.db); const service = new AgentRoleService(repository, new ProjectRepository(opened.db), new ProviderRepository(opened.db));
    await service.initializeBuiltIns(); await service.initializeBuiltIns(); const roles = await service.list();
    expect(roles.map((role) => role.slug)).toEqual(["implementation-engineer", "reviewer", "senior-engineer", "tester"]);
    expect(roles.every((role) => role.builtIn && role.providerId === null && role.modelId === null)).toBe(true); await opened.client.close();
  });

  it("creates project roles and records model and enabled-state changes", async () => {
    const opened = await openDatabase(":memory:"); const projects = new ProjectRepository(opened.db); const repository = new AgentRoleRepository(opened.db); const providers = new ProviderRepository(opened.db); const service = new AgentRoleService(repository, projects, providers);
    const project = await projects.create({ name: "App", repositoryRoot: "C:\\code\\app", defaultBranch: "main", completionPolicy: "manual" });
    await service.initializeBuiltIns();
    const role = await service.create({ projectId: project.id, slug: "frontend-specialist", name: "Frontend Specialist", description: "Implements UI work.", promptTemplate: "Implement the approved UI task.", providerId: null, modelId: null, capabilities: ["code", "test"], limits: { maxTurns: 25, timeoutSeconds: 1200, maxRetries: 1 }, enabled: true });
    const provider = await providers.create({ name: "Anthropic", kind: "anthropic", authMethod: "api_key", command: null, models: ["claude-sonnet"] });
    const assigned = await service.assignModel(role.id, provider.id, "claude-sonnet"); expect(assigned).toMatchObject({ providerId: provider.id, modelId: "claude-sonnet" });
    expect((await service.setEnabled(role.id, false)).enabled).toBe(false);
    expect((await repository.history(role.id)).map((event) => event.type)).toEqual(["agent_role.created", "agent_role.model_assigned", "agent_role.disabled"]);
    expect((await service.list(project.id)).some((item) => item.id === role.id)).toBe(true); await opened.client.close();
  });

  it("rejects assigning a model the provider was never connected with", async () => {
    const opened = await openDatabase(":memory:"); const projects = new ProjectRepository(opened.db); const providers = new ProviderRepository(opened.db); const service = new AgentRoleService(new AgentRoleRepository(opened.db), projects, providers);
    await service.initializeBuiltIns();
    const roleList = await service.list();
    const provider = await providers.create({ name: "Anthropic", kind: "anthropic", authMethod: "api_key", command: null, models: ["claude-sonnet"] });
    await expect(service.assignModel(roleList[0]!.id, provider.id, "claude-haiku")).rejects.toThrow("is not connected with model");
    await expect(service.assignModel(roleList[0]!.id, "missing-provider", "claude-sonnet")).rejects.toThrow("Provider connection not found");
    await opened.client.close();
  });

  it("rejects a role that assigns only a provider or only a model", async () => {
    const opened = await openDatabase(":memory:"); const service = new AgentRoleService(new AgentRoleRepository(opened.db), new ProjectRepository(opened.db), new ProviderRepository(opened.db));
    await expect(service.create({ projectId: null, slug: "invalid", name: "Invalid", description: "Invalid assignment.", promptTemplate: "Do work.", providerId: "openai", modelId: null, capabilities: ["code"], limits: { maxTurns: 10, timeoutSeconds: 600, maxRetries: 1 }, enabled: true })).rejects.toThrow("Provider and model"); await opened.client.close();
  });
});
