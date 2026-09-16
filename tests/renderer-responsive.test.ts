import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

describe("desktop renderer responsiveness", () => {
  it.skipIf(process.platform !== "win32" || !existsSync(chrome))(
    "wraps long notification text and toggles the sidebar without horizontal overflow",
    async () => {
      const server = await createServer({
        configFile: "vite.renderer.config.ts",
        server: { host: "127.0.0.1", port: 0 },
      });
      const browser = await chromium.launch({ executablePath: chrome, headless: true });
      try {
        await server.listen();
        const address = server.httpServer?.address();
        if (!address || typeof address === "string") throw new Error("Renderer test server did not start");
        const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
        await page.addInitScript(() => {
          const longText = "verylongworkflowdetail".repeat(40);
          Object.assign(window, {
            browserSetupSaves: 0,
            awenes: {
              onActivity: () => () => {},
              onFeedback: () => () => {},
              executionPolicy: async () => ({ networkAccess: "none", autoGrantAgentAccess: false, commandAllowlist: ["git"], environmentAllowlist: [], processTimeoutSeconds: 900, requirePushApproval: true, isolatedBrowserProfile: true }),
              suggestBrowserConfig: async () => ({ startCommand: "pnpm", startArgs: ["dev"], baseUrl: "http://localhost:5173", healthCheckUrl: "http://localhost:5173", browserExecutable: "C:\\chrome.exe", scriptOptions: ["dev"], warnings: [] }),
              saveBrowserConfig: async (input: unknown) => { (window as any).browserSetupSaves += 1; (window as any).lastBrowserSetup = input; },
              runDetails: async () => ({
                run: { id: "run", taskId: "test", projectId: "project", status: "failed", currentStage: "plan" },
                steps: [], approvals: [], plans: [], interventions: [], browserEvidence: [],
                browserConfigured: false,
                delivery: { review: { status: "changed", diffStat: longText, diff: longText } },
              }),
              snapshot: async () => ({
                projects: [{ id: "project", name: "Sample", repositoryRoot: "C:\\sample", completionPolicy: "manual", defaultBranch: "main" }],
                tasks: [{
                  id: "test", projectId: null, title: longText, source: "manual",
                  status: "completed", updatedAt: new Date().toISOString(),
                }],
                archivedTasks: [], roles: [], providers: [],
                runs: [{
                  id: "run", taskId: "test", projectId: "project", status: "failed",
                  currentStage: "plan", error: longText,
                  updatedAt: new Date().toISOString(), stepStatus: "failed",
                }],
                archivedRuns: [], approvals: [],
                notifications: [{
                  key: "workflow_completed:test", taskId: "test",
                  kind: "workflow_completed", severity: "action",
                  title: "Agent run completed", detail: longText,
                  suggestedAction: "Open task review",
                }],
              }),
            },
          });
        });
        await page.goto(`http://127.0.0.1:${address.port}/`);
        await page.getByRole("button", { name: "Notifications" }).click();
        expect(await page.locator("nav svg").count()).toBe(9);
        await page.getByText("Agent run completed").waitFor();
        const hasOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Expand sidebar" }).click();
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Collapse sidebar" }).click();
        await page.setViewportSize({ width: 380, height: 800 });
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Runs" }).click();
        expect(await hasOverflow()).toBe(false);
        await page.locator(".run-row").click();
        await page.locator("pre").first().waitFor();
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Tasks" }).click();
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Expand sidebar" }).click();
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Collapse sidebar" }).click();
        await page.setViewportSize({ width: 960, height: 800 });
        expect(await hasOverflow()).toBe(false);
        await page.getByRole("button", { name: "Safety" }).click();
        await page.getByRole("button", { name: "Suggest setup from project" }).click();
        await page.getByText("Command preview:").waitFor();
        expect(await page.evaluate(() => (window as any).browserSetupSaves)).toBe(0);
        await page.getByLabel("I reviewed this command and localhost access.").check();
        await page.getByRole("button", { name: "Save browser setup" }).click();
        expect(await page.evaluate(() => (window as any).browserSetupSaves)).toBe(1);
        expect(await page.evaluate(() => (window as any).lastBrowserSetup)).toMatchObject({ confirmLocalhostAccess: true, config: { startCommand: "pnpm", baseUrl: "http://localhost:5173" } });
        await page.close();
      } finally {
        await browser.close();
        await server.close();
      }
    },
    60_000,
  );
});
