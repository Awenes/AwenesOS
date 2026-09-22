import { afterAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PlaywrightBrowserAutomation } from "../src/infrastructure/browser/playwright-browser-automation.js";
import { GuardedCommandExecutor } from "../src/infrastructure/execution/guarded-command-executor.js";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputs: string[] = [];
afterAll(async () =>
  Promise.all(
    outputs.map((path) => rm(path, { recursive: true, force: true })),
  ),
);
describe("PlaywrightBrowserAutomation", () => {
  it.skipIf(process.platform !== "win32" || !existsSync(chrome))(
    "uses an isolated Chrome profile and captures evidence",
    async () => {
      const root = resolve("tests/fixtures/browser-smoke"),
        output = await mkdtemp(join(tmpdir(), "awenes-browser-evidence-"));
      outputs.push(output);
      const commands = new GuardedCommandExecutor(root, {
        networkAccess: "localhost",
        autoGrantAgentAccess: true,
        environmentAllowlist: [],
        commandAllowlist: ["node"],
        processTimeoutSeconds: 20,
        requirePushApproval: true,
        isolatedBrowserProfile: true,
      });
      const evidence = await new PlaywrightBrowserAutomation().verify({
        config: {
          projectId: crypto.randomUUID(),
          baseUrl: "http://127.0.0.1:43197",
          healthCheckUrl: "http://127.0.0.1:43197/health",
          startCommand: "node",
          startArgs: ["server.mjs"],
          setupCommand: null,
          cleanupCommand: null,
          credentialKeys: ["password"],
          actions: [
            { type: "fill", selector: "#password", credentialKey: "password" },
            { type: "click", selector: "#submit" },
          ],
          assertions: [
            { type: "text", selector: "#result", value: "Ready" },
            { type: "status", value: 200 },
          ],
          browserExecutable: chrome,
        },
        worktreePath: root,
        outputDirectory: output,
        credentials: { password: "test-secret" },
        commands,
      });
      expect(evidence.passed).toBe(true);
      expect((await stat(evidence.screenshotPath!)).size).toBeGreaterThan(0);
      expect((await stat(evidence.tracePath!)).size).toBeGreaterThan(0);
      expect(evidence.consoleErrors).toEqual(["debug value: [redacted]"]);
      expect(
        evidence.consoleErrors.some((value) => value.includes("test-secret")),
      ).toBe(false);
    },
    30_000,
  );
});
