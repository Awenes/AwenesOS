import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  BrowserTestConfigSchema,
  type BrowserTestConfig,
  type BrowserTestEvidence,
} from "../../domain/browser-test.js";
import type { Database } from "../db/database.js";
import { browserTestConfigs, browserTestEvidence } from "../db/schema.js";
export class BrowserTestRepository {
  constructor(private db: Database) {}
  async saveConfig(input: BrowserTestConfig) {
    const config = BrowserTestConfigSchema.parse(input);
    await this.db
      .insert(browserTestConfigs)
      .values({ projectId: config.projectId, config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: browserTestConfigs.projectId,
        set: { config, updatedAt: new Date() },
      });
    return config;
  }
  async config(projectId: string) {
    const row = await this.db.query.browserTestConfigs.findFirst({
      where: eq(browserTestConfigs.projectId, projectId),
    });
    return row ? BrowserTestConfigSchema.parse(row.config) : null;
  }
  async saveEvidence(input: Omit<BrowserTestEvidence, "id" | "createdAt">) {
    const value: BrowserTestEvidence = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    await this.db
      .insert(browserTestEvidence)
      .values({
        ...value,
        assertions: value.assertions as Array<Record<string, unknown>>,
      });
    return value;
  }
  evidence(runId: string) {
    return this.db
      .select()
      .from(browserTestEvidence)
      .where(eq(browserTestEvidence.runId, runId))
      .orderBy(asc(browserTestEvidence.createdAt));
  }
}
