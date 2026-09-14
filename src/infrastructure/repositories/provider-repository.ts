import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { ProviderConnection, ProviderConnectionInput, ProviderStatus } from "../../domain/provider.js";
import type { Database } from "../db/database.js";
import { providerConnections, providerEvents } from "../db/schema.js";

export class ProviderRepository {
  constructor(private readonly db: Database) {}

  async create(input: ProviderConnectionInput): Promise<ProviderConnection> {
    const now = new Date();
    const connection: ProviderConnection = { id: randomUUID(), ...input, status: "unverified", error: null, createdAt: now, updatedAt: now, lastCheckedAt: null };
    await this.db.insert(providerConnections).values(connection);
    await this.event(connection.id, "provider.created", { kind: input.kind, authMethod: input.authMethod }, now);
    return connection;
  }

  async get(id: string): Promise<ProviderConnection> {
    const row = await this.db.query.providerConnections.findFirst({ where: eq(providerConnections.id, id) });
    if (!row) throw new Error(`Provider connection not found: ${id}`);
    return row as ProviderConnection;
  }

  async list(): Promise<ProviderConnection[]> { return await this.db.select().from(providerConnections).orderBy(asc(providerConnections.name)) as ProviderConnection[]; }

  async recordCheck(id: string, status: ProviderStatus, error: string | null): Promise<ProviderConnection> {
    await this.get(id); const now = new Date();
    await this.db.update(providerConnections).set({ status, error, lastCheckedAt: now, updatedAt: now }).where(eq(providerConnections.id, id));
    await this.event(id, status === "ready" ? "provider.ready" : "provider.check_failed", { error }, now);
    return this.get(id);
  }
  async updateCommand(id: string, command: string): Promise<ProviderConnection> {
    const current = await this.get(id);
    if (current.command === command) return current;
    const now = new Date();
    await this.db.update(providerConnections).set({ command, updatedAt: now }).where(eq(providerConnections.id, id));
    await this.event(id, "provider.command_resolved", { command }, now);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await this.get(id); const now = new Date();
    await this.event(id, "provider.removed", {}, now);
    await this.db.update(providerConnections).set({ status: "disconnected", error: null, updatedAt: now }).where(eq(providerConnections.id, id));
  }

  history(providerId: string) { return this.db.select().from(providerEvents).where(eq(providerEvents.providerId, providerId)).orderBy(asc(providerEvents.occurredAt)); }
  private async event(providerId: string, type: string, data: Record<string, unknown>, occurredAt: Date) { await this.db.insert(providerEvents).values({ id: randomUUID(), providerId, type, data, occurredAt }); }
}
