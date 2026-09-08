import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskService } from "../src/application/task-service.js";
import { GuidedCli, type GuidedIO } from "../src/cli/guided-cli.js";
import { MockCrmAdapter } from "../src/infrastructure/crm/mock-crm-adapter.js";
import { openDatabase } from "../src/infrastructure/db/database.js";
import { TaskRepository } from "../src/infrastructure/repositories/task-repository.js";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));
class ScriptedIO implements GuidedIO {
  readonly output: string[] = [];
  constructor(private readonly answers: string[]) {}
  async ask() {
    const answer = this.answers.shift();
    if (answer === undefined) throw new Error("Test ran out of guided answers");
    return answer;
  }
  write(message: string) { this.output.push(message); }
  close() {}
}
describe("guided CLI", () => {
  it("captures a task without exposing task IDs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "awenes-guided-")); dirs.push(dir);
    const opened = await openDatabase(":memory:");
    const service = new TaskService(new TaskRepository(opened.db), new MockCrmAdapter(join(dir, "crm.json")));
    const io = new ScriptedIO(["1", "Fix enrollment validation", "5", "Handle invalid student records", "", "yes", "9"]);
    await new GuidedCli(service, io).run();
    const inbox = await service.inbox();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.title).toBe("Fix enrollment validation");
    expect(inbox[0]?.source).toBe("manual");
    expect(io.output.join("\n")).toContain("Next: review the inbox");
    expect(io.output.join("\n")).not.toContain(inbox[0]?.id);
    opened.client.close();
  });
});
