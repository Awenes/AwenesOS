import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

describe("skill studio", () => {
  it.skipIf(process.platform !== "win32" || !existsSync(chrome))(
    "creates a reviewed skill with multi-select permissions, and cancel discards the draft",
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
            savedSkills: [] as unknown[],
            awenes: {
              onActivity: () => () => {},
              onFeedback: () => () => {},
              snapshot: async () => ({
                projects: [{ id: "project-1", name: "Sample project", repositoryRoot: "C:\\sample", completionPolicy: "manual", defaultBranch: "main" }],
                tasks: [], archivedTasks: [], roles: [], providers: [],
                runs: [], archivedRuns: [], approvals: [], notifications: [],
              }),
              saveSkill: async (input: unknown) => {
                (window as unknown as { savedSkills: unknown[] }).savedSkills.push(input);
              },
            },
          });
        });
        await page.goto(`http://127.0.0.1:${address.port}/`);
        await page.getByRole("button", { name: "Agents" }).click();

        // Cancel discards the draft without saving.
        await page.getByRole("button", { name: "+ Local skill" }).click();
        const draftForm = page.locator(".floating-form");
        await draftForm.getByLabel("Name").fill("Discarded skill");
        await page.getByRole("button", { name: "Cancel" }).click();
        expect(await page.locator(".floating-form").count()).toBe(0);
        expect(await page.evaluate(() => (window as unknown as { savedSkills: unknown[] }).savedSkills.length)).toBe(0);

        // Reopening gives a clean draft.
        await page.getByRole("button", { name: "+ Local skill" }).click();
        const form = page.locator(".floating-form");
        expect(await form.locator(".multi-select-trigger").innerText()).toContain("No permissions selected");

        // The permissions control is a closed dropdown until opened.
        expect(await page.locator(".multi-select-panel").count()).toBe(0);
        await form.locator(".multi-select-trigger").click();
        expect(await page.locator(".multi-select-panel").count()).toBe(1);

        // Multiple permissions can be selected without closing the dropdown.
        await page.getByRole("checkbox", { name: /Read repository/ }).check();
        await page.getByRole("checkbox", { name: /Run commands/ }).check();
        expect(await page.locator(".multi-select-panel").count()).toBe(1);
        const trigger = await form.locator(".multi-select-trigger").innerText();
        expect(trigger).toContain("Read repository");
        expect(trigger).toContain("Run commands");

        // Clicking outside the dropdown closes it and keeps the selection.
        await form.getByLabel("Name").click();
        expect(await page.locator(".multi-select-panel").count()).toBe(0);
        expect(await form.locator(".multi-select-trigger").innerText()).toContain("Read repository");

        // Fill the rest of the draft and submit.
        await form.getByLabel("Name").fill("Deploy checklist");
        await form.getByLabel("Slug").fill("deploy-checklist");
        await form.getByLabel("Instructions").fill("Verify the build before shipping.");
        await form.getByLabel("I reviewed this exact content and its permissions").check();
        await page.getByRole("button", { name: "Snapshot skill" }).click();
        await page.waitForFunction(() => (window as unknown as { savedSkills: unknown[] }).savedSkills.length > 0);

        expect(await page.locator(".floating-form").count()).toBe(0);
        const saved = await page.evaluate(() => (window as unknown as { savedSkills: unknown[] }).savedSkills[0]);
        expect(saved).toMatchObject({
          projectId: null,
          source: "personal",
          slug: "deploy-checklist",
          name: "Deploy checklist",
          version: "1.0.0",
          content: "Verify the build before shipping.",
          permissions: ["read_repository", "run_commands"],
          reviewed: true,
        });
        await page.close();
      } finally {
        await browser.close();
        await server.close();
      }
    },
    60_000,
  );
});
