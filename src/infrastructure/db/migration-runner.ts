import type { Client } from "@libsql/client";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { currentDatabaseVersion, databaseMigrations } from "./migrations.js";

export interface MigrationResult { fromVersion: number; toVersion: number; applied: number[]; backupPath: string | null; }

export async function migrateDatabase(client: Client, databasePath: string): Promise<MigrationResult> {
  const hasLedger = Boolean((await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_awenes_migrations'`)).rows.length);
  const appliedRows = hasLedger ? (await client.execute(`SELECT version FROM _awenes_migrations ORDER BY version`)).rows : [];
  const appliedVersions = new Set(appliedRows.map((row) => Number(row.version)));
  const fromVersion = appliedVersions.size ? Math.max(...appliedVersions) : 0;
  const pending = databaseMigrations.filter((migration) => !appliedVersions.has(migration.version));
  const existingUserTables = (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_awenes_migrations'`)).rows.length;
  let backupPath: string | null = null;
  if (pending.length && existingUserTables > 0 && databasePath !== ":memory:" && await exists(databasePath)) backupPath = await createDatabaseBackup(client, databasePath);
  await client.execute(`CREATE TABLE IF NOT EXISTS _awenes_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  for (const migration of pending) {
    await client.batch([...migration.statements, { sql: `INSERT INTO _awenes_migrations (version, name, applied_at) VALUES (?, ?, ?)`, args: [migration.version, migration.name, Date.now()] }], "write");
  }
  return { fromVersion, toVersion: currentDatabaseVersion, applied: pending.map((migration) => migration.version), backupPath };
}

export async function createDatabaseBackup(client: Client, databasePath: string, destination?: string): Promise<string> {
  if (databasePath === ":memory:") throw new Error("In-memory databases cannot be backed up to a file");
  const source = resolve(databasePath); const target = destination ? resolve(destination) : defaultBackupPath(source);
  if (source.toLocaleLowerCase() === target.toLocaleLowerCase()) throw new Error("Backup destination must differ from the database path");
  await mkdir(dirname(target), { recursive: true });
  await client.execute(`PRAGMA wal_checkpoint(TRUNCATE)`);
  await copyFile(source, target);
  return target;
}

function defaultBackupPath(source: string) { const extension = extname(source) || ".db"; const name = source.slice(0, source.length - extension.length).split(/[\\/]/).at(-1) ?? "awenes"; const stamp = new Date().toISOString().replace(/[:.]/g, "-"); return join(dirname(source), "backups", `${name}-${stamp}${extension}`); }
async function exists(path: string) { try { return (await stat(path)).isFile(); } catch { return false; } }
