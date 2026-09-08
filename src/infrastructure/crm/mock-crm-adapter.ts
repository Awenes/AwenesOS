import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { CrmTaskAdapter, CrmTaskMapping } from "../../domain/crm.js";

type MockRecord = { id: string; projectId: string; title: string; description: string; status: string; updatedAt: string };

export class MockCrmAdapter implements CrmTaskAdapter {
  readonly name = "mock";
  constructor(private readonly path = process.env.AWENES_MOCK_CRM_PATH ?? "./data/mock-crm.json") {}

  async createTask(input: { projectId: string; title: string; description: string }) {
    const records = await this.read();
    const id = `mock-${randomUUID()}`;
    records.push({ id, ...input, status: "planned", updatedAt: new Date().toISOString() });
    await this.write(records);
    return { externalTaskId: id, externalUrl: `mock://crm/projects/${input.projectId}/tasks/${id}` };
  }

  async updateExecutionStatus(mapping: CrmTaskMapping, status: "in_progress" | "paused") {
    await this.update(mapping.externalTaskId, (record) => ({ ...record, status, updatedAt: new Date().toISOString() }));
  }

  async completeTask(mapping: CrmTaskMapping, input: { assignmentDescription: string; completionDescription: string }) {
    await this.update(mapping.externalTaskId, (record) => ({ ...record, description: formatDescription(input), status: "completed", updatedAt: new Date().toISOString() }));
  }

  private async update(id: string, change: (record: MockRecord) => MockRecord) {
    const records = await this.read();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) throw new Error(`Mock CRM task not found: ${id}`);
    records[index] = change(records[index]!);
    await this.write(records);
  }

  private async read(): Promise<MockRecord[]> {
    try { return JSON.parse(await readFile(resolve(this.path), "utf8")) as MockRecord[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  private async write(records: MockRecord[]) {
    const path = resolve(this.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

function formatDescription(input: { assignmentDescription: string; completionDescription: string }) {
  return `TASK\n${input.assignmentDescription || "No assignment description provided."}\n\nCOMPLETION\n${input.completionDescription}`;
}
