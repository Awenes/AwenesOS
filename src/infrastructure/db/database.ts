import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";
import { migrateDatabase, type MigrationResult } from "./migration-runner.js";

export type Database = LibSQLDatabase<typeof schema>;

export async function openDatabase(path = process.env.AWENES_DB_PATH ?? "./data/awenes.db"): Promise<{ db: Database; client: Client; path: string; migration: MigrationResult }> {
  const inMemory = path === ":memory:";
  const absolute = inMemory ? path : resolve(path);
  if (!inMemory) mkdirSync(dirname(absolute), { recursive: true });
  const client = createClient({ url: inMemory ? "file::memory:" : `file:${absolute}` });
  const migration = await migrateDatabase(client, absolute);
  return { db: drizzle(client, { schema }), client, path: absolute, migration };
}
