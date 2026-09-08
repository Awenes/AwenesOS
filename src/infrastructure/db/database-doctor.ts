import type { Client } from "@libsql/client";
import { currentDatabaseVersion } from "./migrations.js";

export interface DatabaseHealth { healthy: boolean; integrity: string; foreignKeyViolations: number; databaseVersion: number; currentVersion: number; }

export async function inspectDatabase(client: Client): Promise<DatabaseHealth> {
  const integrityRows = (await client.execute(`PRAGMA integrity_check`)).rows;
  const integrity = integrityRows.map((row) => String(Object.values(row)[0])).join(", ") || "unknown";
  const foreignKeyViolations = (await client.execute(`PRAGMA foreign_key_check`)).rows.length;
  const versionRows = (await client.execute(`SELECT MAX(version) AS version FROM _awenes_migrations`)).rows;
  const databaseVersion = Number(versionRows[0]?.version ?? 0);
  return { healthy: integrity === "ok" && foreignKeyViolations === 0 && databaseVersion === currentDatabaseVersion, integrity, foreignKeyViolations, databaseVersion, currentVersion: currentDatabaseVersion };
}
