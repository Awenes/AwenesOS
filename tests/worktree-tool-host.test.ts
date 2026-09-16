import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorktreeToolHost } from "../src/infrastructure/execution/worktree-tool-host.js";
import type { CommandExecutor } from "../src/domain/execution.js";

const created: string[] = [];
afterEach(async () =>
  Promise.all(
    created.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  ),
);

describe("WorktreeToolHost role permissions", () => {
  it("allows repository reads but denies writes without the code capability", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-role-tools-"));
    created.push(root);
    const commands = {} as CommandExecutor;
    const policy = {
      networkAccess: "none" as const,
      autoGrantAgentAccess: false,
      environmentAllowlist: [],
      commandAllowlist: [],
      processTimeoutSeconds: 30,
      requirePushApproval: true,
      isolatedBrowserProfile: true as const,
    };
    const reviewer = new WorktreeToolHost(root, policy, commands, ["review"]);
    await expect(
      reviewer.execute({
        id: "1",
        name: "write_file",
        arguments: { path: "change.txt", content: "no" },
      }),
    ).rejects.toThrow("code capability");
    const implementer = new WorktreeToolHost(root, policy, commands, ["code"]);
    await implementer.execute({
      id: "2",
      name: "write_file",
      arguments: { path: "change.txt", content: "yes" },
    });
    expect(await readFile(join(root, "change.txt"), "utf8")).toBe("yes");
  });
});
