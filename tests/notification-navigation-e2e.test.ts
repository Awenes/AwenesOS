import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

describe("notification and approval navigation", () => {
  it.skipIf(process.platform !== "win32" || !existsSync(chrome))(
    "routes a failed-run notification to that run, and confirms before cancelling a non-plan approval",
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
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.addInitScript(() => {
          Object.assign(window, {
            decisions: [] as unknown[],
            awenes: {
              onActivity: () => () => {},
              onFeedback: () => () => {},
              snapshot: async () => ({
                projects: [{ id: "project-1", name: "Sample project", repositoryRoot: "C:\\sample", completionPolicy: "manual", defaultBranch: "main" }],
                tasks: [{ id: "task-1", projectId: "project-1", title: "Fix the webhook", source: "manual", status: "in_progress", updatedAt: new Date().toISOString() }],
                archivedTasks: [],
                roles: [],
                providers: [],
                runs: [{ id: "run-1", taskId: "task-1", projectId: "project-1", status: "failed", currentStage: "review", error: "Reviewer needs a provider and model", updatedAt: new Date().toISOString(), stepStatus: "failed" }],
                archivedRuns: [],
                approvals: [{ id: "approval-1", runId: "run-1", kind: "start", status: "pending", detail: "Review the exact roles, prompts, skills, and permissions before execution starts.", requestedAt: new Date().toISOString() }],
                notifications: [{ key: "n1", taskId: "task-1", kind: "workflow_failed", severity: "critical", title: "Agent run failed", detail: "Fix the webhook: Reviewer needs a provider and model", suggestedAction: "Inspect or resume the run" }],
              }),
              runDetails: async (id: string) => ({
                run: { id, taskId: "task-1", projectId: "project-1", status: "failed", currentStage: "review", error: "Reviewer needs a provider and model" },
                steps: [], approvals: [], plans: [], interventions: [], browserEvidence: [],
                browserConfigured: false,
                delivery: null,
              }),
              taskSummary: async () => ({
                task: { id: "task-1", projectId: "project-1", title: "Fix the webhook", status: "in_progress" },
                duration: { active: "1h", paused: "0m", calendar: "1h" },
                evidence: [],
                repository: null,
              }),
              decideApproval: async (input: unknown) => {
                (window as unknown as { decisions: unknown[] }).decisions.push(input);
              },
            },
          });
        });
        await page.goto(`http://127.0.0.1:${address.port}/`);
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        await page.getByRole("button", { name: "Open run →" }).click();
        await page.getByText("Technical details").waitFor();
        await page.getByRole("heading", { name: "Run Inspector" }).waitFor();

        await page.getByRole("button", { name: /^Approvals\s*\d*$/ }).click();
        await page.getByRole("button", { name: "Cancel run" }).click();
        const dialog = page.locator(".confirm-dialog");
        await dialog.getByText("cancels the entire workflow run").waitFor();
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(await page.locator(".confirm-dialog").count()).toBe(0);
        expect(await page.evaluate(() => (window as unknown as { decisions: unknown[] }).decisions.length)).toBe(0);

        await page.getByRole("button", { name: "Cancel run" }).click();
        await dialog.getByRole("button", { name: "Cancel run" }).click();
        await page.waitForFunction(() => (window as unknown as { decisions: unknown[] }).decisions.length > 0);
        expect(await page.evaluate(() => (window as unknown as { decisions: unknown[] }).decisions[0])).toMatchObject({ approvalId: "approval-1", approved: false });
        await page.close();
      } finally {
        await browser.close();
        await server.close();
      }
    },
    60_000,
  );
});
