import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectDatabase } from "../src/infrastructure/db/database-doctor.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { currentDatabaseVersion } from "../src/infrastructure/db/migrations.js";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map(async (directory) => {
  try { await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 }); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBUSY")) throw error; }
})));

describe("database migrations", () => {
  it("creates and records the current schema for a new database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "awenes-migration-")); dirs.push(directory); const path = join(directory, "awenes.db");
    const opened = await openDatabase(path);
    expect(opened.migration).toMatchObject({ fromVersion: 0, toVersion: currentDatabaseVersion, applied: Array.from({ length: currentDatabaseVersion }, (_, index) => index + 1), backupPath: null });
    expect(await inspectDatabase(opened.client)).toEqual({ healthy: true, integrity: "ok", foreignKeyViolations: 0, databaseVersion: currentDatabaseVersion, currentVersion: currentDatabaseVersion });
    await opened.client.close();
  });

  it("backs up and adopts a legacy database without losing task rows", async () => {
    const directory = await mkdtemp(join(tmpdir(), "awenes-legacy-")); dirs.push(directory); const path = join(directory, "awenes.db");
    const legacy = createClient({ url: `file:${path}` });
    await legacy.execute(`CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, source_reference TEXT, assignment_description TEXT NOT NULL DEFAULT '', completion_description TEXT, status TEXT NOT NULL, assigned_to_me INTEGER NOT NULL DEFAULT 0, sync_error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER)`);
    await legacy.execute({ sql: `INSERT INTO tasks (id,title,source,assignment_description,status,assigned_to_me,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`, args: ["legacy-1", "Preserve me", "manual", "", "captured", 0, 1, 1] }); await legacy.close();
    const opened = await openDatabase(path);
    expect(opened.migration.applied).toEqual(Array.from({ length: currentDatabaseVersion }, (_, index) => index + 1)); expect(opened.migration.backupPath).toBeTruthy(); expect((await stat(opened.migration.backupPath!)).isFile()).toBe(true);
    expect((await opened.client.execute(`SELECT title FROM tasks WHERE id = 'legacy-1'`)).rows[0]?.title).toBe("Preserve me");
    expect((await readdir(join(directory, "backups"))).length).toBe(1); await opened.client.close();
  });

  it("enforces foreign keys and indexes task_worktrees by project", async () => {
    const directory = await mkdtemp(join(tmpdir(), "awenes-fk-")); dirs.push(directory); const path = join(directory, "awenes.db");
    const opened = await openDatabase(path);
    expect((await opened.client.execute(`PRAGMA foreign_keys`)).rows[0]?.foreign_keys).toBe(1);
    const indexes = (await opened.client.execute(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'task_worktrees'`)).rows.map((row) => row.name);
    expect(indexes).toContain("task_worktrees_project_idx");
    await expect(
      opened.client.execute({ sql: `INSERT INTO task_worktrees (id, task_id, project_id, path, branch, base_branch, status, created_at) VALUES (?,?,?,?,?,?,?,?)`, args: ["w1", "missing-task", "missing-project", "C:\\work", "b", "main", "active", 1] }),
    ).rejects.toThrow();
    await opened.client.close();
  });

  it("does not create another backup when no migration is pending", async () => {
    const directory = await mkdtemp(join(tmpdir(), "awenes-current-")); dirs.push(directory); const path = join(directory, "awenes.db");
    const first = await openDatabase(path); await first.client.close(); const second = await openDatabase(path);
    expect(second.migration).toMatchObject({ fromVersion: currentDatabaseVersion, toVersion: currentDatabaseVersion, applied: [], backupPath: null }); await second.client.close();
  });
});
