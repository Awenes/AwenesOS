import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  it("resolves an allowlisted command from PATH, ignoring a same-named file planted in the worktree", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-exec-"));
    dirs.push(root);
    // Simulate a task worktree (the agent's own writable, untrusted output)
    // containing a decoy that shadows a trusted command's name. Node's
    // spawn() must never let cwd take precedence over PATH when resolving it.
    const decoyPath = join(root, process.platform === "win32" ? "node.cmd" : "node");
    await writeFile(decoyPath, process.platform === "win32" ? "@echo planted\r\n" : "#!/bin/sh\necho planted\n", "utf8");
    if (process.platform !== "win32") await chmod(decoyPath, 0o755);
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
      args: ["-e", "process.stdout.write('real')"],
      cwd: root,
      network: "none",
    });
    expect(result.stdout).toBe("real");
  });
  it("settles with a timed-out result instead of hanging when a process outlives its timeout", async () => {
    const root = await mkdtemp(join(tmpdir(), "awenes-exec-"));
    dirs.push(root);
    const runner = new GuardedCommandExecutor(root, {
      networkAccess: "none",
      autoGrantAgentAccess: false,
      environmentAllowlist: [],
      commandAllowlist: ["node"],
      processTimeoutSeconds: 60,
      requirePushApproval: true,
      isolatedBrowserProfile: true,
    });
    const started = Date.now();
    const result = await runner.execute({
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000)"],
      cwd: root,
      network: "none",
      timeoutSeconds: 1,
    });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(result.timedOut).toBe(true);
  });
});
