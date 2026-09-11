import type { ProviderConnectionInput, ProviderProbe, SecretVault } from "../domain/provider.js";
import { ProviderConnectionInputSchema } from "../domain/provider.js";
import type { ProviderRepository } from "../infrastructure/repositories/provider-repository.js";

export class ProviderService {
  constructor(private readonly repository: ProviderRepository, private readonly vault: SecretVault, private readonly probe: ProviderProbe) {}

  list() { return this.repository.list(); }

  async connect(input: ProviderConnectionInput, apiKey?: string) {
    const parsed = ProviderConnectionInputSchema.parse(input);
    if (parsed.authMethod === "api_key" && !apiKey?.trim()) throw new Error("An API key is required");
    const connection = await this.repository.create(parsed);
    try {
      if (apiKey) await this.vault.set(secretKey(connection.id), apiKey.trim());
      return await this.verify(connection.id);
    } catch (error) {
      await this.repository.recordCheck(connection.id, "error", message(error));
      throw error;
    }
  }

  async verify(id: string) {
    const connection = await this.repository.get(id);
    const secret = connection.authMethod === "api_key" ? await this.vault.get(secretKey(id)) : null;
    const result = await this.probe.check(connection, secret);
    return this.repository.recordCheck(id, result.ready ? "ready" : "error", result.ready ? null : result.detail);
  }

  async remove(id: string) { await this.vault.delete(secretKey(id)); await this.repository.remove(id); }
}

const secretKey = (id: string) => `provider:${id}`;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
