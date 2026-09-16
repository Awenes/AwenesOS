import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GuardedCommandExecutor } from "../src/infrastructure/execution/guarded-command-executor.js";
const dirs: string[] = [];
afterEach(async () =>
  Promise.all(
    dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  ),
);
describe("GuardedCommandExecutor", () => {
  it("runs only allowlisted commands inside the worktree with filtered secrets", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-exec-"));
    dirs.push(root);
    process.env.AWENES_TEST_SECRET = "hidden";
    const runner = new GuardedCommandExecutor(root, {
      networkAccess: "none",
      autoGrantAgentAccess: false,
      environmentAllowlist: [],
      commandAllowlist: ["node"],
      processTimeoutSeconds: 5,
      requirePushApproval: true,
      isolatedBrowserProfile: true,
    });
    const result = await runner.execute({
      command: "node",
      args: [
        "-e",
        "process.stdout.write(process.env.AWENES_TEST_SECRET||'safe')",
      ],
      cwd: root,
      network: "none",
    });
    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "safe",
      timedOut: false,
    });
    await expect(
      runner.execute({
        command: "git",
        args: ["status"],
        cwd: root,
        network: "none",
      }),
    ).rejects.toThrow("not allowed");
    await expect(
      runner.execute({
        command: "node",
        args: ["-v"],
        cwd: join(root, ".."),
        network: "none",
      }),
    ).rejects.toThrow("outside");
  });
});
