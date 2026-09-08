import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TrackerImportService } from "../src/application/tracker-import-service.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";
import { CsvTrackerAdapter } from "../src/infrastructure/tracker/csv-tracker-adapter.js";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

describe("tracker ingestion", () => {
  it("normalizes configured columns, filters statuses, and keeps imports as candidates", async () => {
    const dir = await mkdtemp(join(tmpdir(), "awenes-tracker-")); dirs.push(dir);
    const csv = join(dir, "issues.csv");
    await writeFile(csv, 'Issue Key,Summary,Details,Workflow,Link\nBUG-1,"Broken, invite",Duplicates are sent,Ready,https://tracker/BUG-1\nBUG-2,Old issue,Already fixed,Done,https://tracker/BUG-2\n');
    const opened = await openDatabase(":memory:");
    const repository = new TaskRepository(opened.db);
    const importer = new TrackerImportService(repository, new CsvTrackerAdapter());
    const config = { project: "skoolbod", columns: { id: ["ID", "Issue Key"], title: ["Title", "Summary"], description: "Details", status: "Workflow", url: "Link" }, statuses: { exclude: ["done"] } };

    expect(await importer.import(csv, config)).toEqual({ imported: 1, skippedExisting: 0, skippedByStatus: 1 });
    const tasks = await repository.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: "Broken, invite", source: "bug-tracker", status: "captured", assignedToMe: false, sourceReference: "csv:skoolbod:BUG-1" });
    expect(await importer.import(csv, config)).toEqual({ imported: 0, skippedExisting: 1, skippedByStatus: 1 });
    opened.client.close();
  });

  it("rejects rows without stable identity", async () => {
    const dir = await mkdtemp(join(tmpdir(), "awenes-tracker-")); dirs.push(dir);
    const csv = join(dir, "issues.csv");
    await writeFile(csv, "ID,Title\n,Missing identity\n");
    const opened = await openDatabase(":memory:");
    const importer = new TrackerImportService(new TaskRepository(opened.db), new CsvTrackerAdapter());
    await expect(importer.import(csv, { project: "p", columns: { id: "ID", title: "Title" }, statuses: {} })).rejects.toThrow("requires both id and title");
    opened.client.close();
  });
});
