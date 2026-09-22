import { describe, expect, it } from "vitest";
import { ProviderService } from "../src/application/provider-service.js";
import type { ProviderConnection, ProviderProbe, SecretVault } from "../src/domain/provider.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { ProviderRepository } from "../src/infrastructure/repositories/provider-repository.js";

class MemoryVault implements SecretVault {
  values = new Map<string, string>();
  async set(key: string, value: string) { this.values.set(key, value); }
  async get(key: string) { return this.values.get(key) ?? null; }
  async delete(key: string) { this.values.delete(key); }
}

class FakeProbe implements ProviderProbe {
  seenSecret: string | null = null;
  async check(_connection: ProviderConnection, secret: string | null) { this.seenSecret = secret; return { ready: Boolean(secret), detail: secret ? "Ready" : "Missing credentials" }; }
}

class ResolvedCliProbe implements ProviderProbe {
  async check() { return { ready: false, detail: "Sign in", resolvedCommand: "C:\\tools\\codex.exe" }; }
}

class BrokenVault implements SecretVault {
  async set(): Promise<void> {
    throw new Error("Encryption is not available on this device");
  }
  async get() { return null; }
  async delete() {}
}

describe("ProviderService", () => {
  it("does not leave a stuck provider row when the secret vault fails to store the key", async () => {
    const opened = await openDatabase(":memory:"); const repository = new ProviderRepository(opened.db); const service = new ProviderService(repository, new BrokenVault(), new FakeProbe());
    await expect(
      service.connect({ name: "OpenAI", kind: "openai", authMethod: "api_key", command: null, models: [] }, "key"),
    ).rejects.toThrow("Could not securely store the credential");
    expect(await repository.list()).toMatchObject([{ status: "disconnected" }]);
    opened.client.close();
  });

  it("stores API credentials outside SQLite and records verification events", async () => {
    const opened = await openDatabase(":memory:"); const repository = new ProviderRepository(opened.db); const vault = new MemoryVault(); const probe = new FakeProbe();
    const service = new ProviderService(repository, vault, probe);
    const provider = await service.connect({ name: "OpenAI", kind: "openai", authMethod: "api_key", command: null, models: ["gpt-test"] }, "secret-value");
    expect(provider.status).toBe("ready"); expect(probe.seenSecret).toBe("secret-value");
    expect(JSON.stringify(await repository.list())).not.toContain("secret-value");
    expect((await repository.history(provider.id)).map((event) => event.type)).toEqual(["provider.created", "provider.ready"]);
    opened.client.close();
  });

  it("requires a key for API connections and retains a disconnection audit trail", async () => {
    const opened = await openDatabase(":memory:"); const repository = new ProviderRepository(opened.db); const vault = new MemoryVault(); const service = new ProviderService(repository, vault, new FakeProbe());
    await expect(service.connect({ name: "Anthropic", kind: "anthropic", authMethod: "api_key", command: null, models: [] })).rejects.toThrow("API key");
    const provider = await service.connect({ name: "Anthropic", kind: "anthropic", authMethod: "api_key", command: null, models: [] }, "key");
    await service.remove(provider.id);
    expect((await repository.get(provider.id)).status).toBe("disconnected");
    expect((await repository.history(provider.id)).at(-1)?.type).toBe("provider.removed");
    opened.client.close();
  });

  it("persists a discovered CLI path even when sign-in is still required", async () => {
    const opened = await openDatabase(":memory:");
    const repository = new ProviderRepository(opened.db);
    const service = new ProviderService(repository, new MemoryVault(), new ResolvedCliProbe());
    const provider = await service.connect({ name: "Codex", kind: "openai", authMethod: "cli", command: "codex", models: [] });
    expect(provider).toMatchObject({ status: "error", command: "C:\\tools\\codex.exe", error: "Sign in" });
    expect((await repository.history(provider.id)).map((event) => event.type)).toEqual([
      "provider.created",
      "provider.command_resolved",
      "provider.check_failed",
    ]);
    opened.client.close();
  });
});
