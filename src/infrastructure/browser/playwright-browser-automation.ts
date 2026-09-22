import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright-core";
import type { BrowserAutomation } from "../../application/browser-test-service.js";
import type { ManagedProcess } from "../../domain/execution.js";
export class PlaywrightBrowserAutomation implements BrowserAutomation {
  async verify({
    config,
    worktreePath,
    outputDirectory,
    credentials,
    commands,
  }: Parameters<BrowserAutomation["verify"]>[0]) {
    await mkdir(outputDirectory, { recursive: true });
    const profile = await mkdtemp(join(tmpdir(), "awenes-browser-"));
    let server: ManagedProcess | null = null;
    let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null = null;
    try {
      if (config.setupCommand)
        await ensure(
          await commands.execute({
            ...config.setupCommand,
            cwd: worktreePath,
            network: "localhost",
          }),
        );
      server = await commands.start({
        command: config.startCommand,
        args: config.startArgs,
        cwd: worktreePath,
        network: "localhost",
      });
      await healthy(config.healthCheckUrl);
      context = await chromium.launchPersistentContext(profile, {
        executablePath: config.browserExecutable,
        headless: true,
      });
      const page = context.pages()[0] ?? (await context.newPage());
      const consoleErrors: string[] = [],
        failedRequests: string[] = [];
      const redact = (text: string) => redactCredentials(text, credentials);
      page.on("console", (message) => {
        if (message.type() === "error")
          consoleErrors.push(redact(message.text()));
      });
      page.on("requestfailed", (request) =>
        failedRequests.push(
          redact(
            `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
          ),
        ),
      );
      const usesCredentials = config.actions.some(
        (action) => action.type === "fill",
      );
      await context.tracing.start({
        screenshots: !usesCredentials,
        snapshots: !usesCredentials,
        sources: true,
      });
      const response = await page.goto(config.baseUrl, {
        waitUntil: "networkidle",
      });
      for (const action of config.actions) {
        if (action.type === "click")
          await page.locator(action.selector).click();
        else if (action.type === "fill")
          await page
            .locator(action.selector)
            .fill(credentials[action.credentialKey]!);
        else if (action.type === "press")
          await page.locator(action.selector).press(action.key);
        else await page.locator(action.selector).waitFor({ state: "visible" });
      }
      const assertions = [];
      for (const assertion of config.assertions) {
        try {
          if (assertion.type === "visible")
            await page
              .locator(assertion.selector)
              .waitFor({ state: "visible" });
          else if (assertion.type === "text") {
            const text = await page.locator(assertion.selector).textContent();
            if (!text?.includes(assertion.value))
              throw new Error(`Expected text: ${assertion.value}`);
          } else if (assertion.type === "url") {
            if (!page.url().includes(assertion.value))
              throw new Error(`Expected URL containing ${assertion.value}`);
          } else if (response?.status() !== assertion.value)
            throw new Error(
              `Expected HTTP ${assertion.value}, got ${response?.status()}`,
            );
          assertions.push({ assertion, passed: true, detail: "Passed" });
        } catch (error) {
          assertions.push({
            assertion,
            passed: false,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const screenshotPath = usesCredentials
          ? null
          : join(outputDirectory, "final.png"),
        tracePath = join(outputDirectory, "trace.zip");
      if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
      await context.tracing.stop({ path: tracePath });
      return {
        passed:
          assertions.every((value) => value.passed) &&
          failedRequests.length === 0,
        screenshotPath,
        tracePath,
        consoleErrors,
        failedRequests,
        assertions,
      };
    } finally {
      if (context) await context.close().catch(() => {});
      if (server) await server.stop();
      if (config.cleanupCommand)
        await commands.execute({
          ...config.cleanupCommand,
          cwd: worktreePath,
          network: "localhost",
        });
      await rm(profile, { recursive: true, force: true });
    }
  }
}
async function healthy(url: string) {
  let last = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Health check failed: ${last}`);
}
async function ensure(result: { exitCode: number | null; stderr: string }) {
  if (result.exitCode !== 0)
    throw new Error(result.stderr || `Command exited ${result.exitCode}`);
}
function redactCredentials(text: string, credentials: Record<string, string>) {
  let result = text;
  for (const value of Object.values(credentials)) {
    if (!value) continue;
    result = result.split(value).join("[redacted]");
  }
  return result;
}
