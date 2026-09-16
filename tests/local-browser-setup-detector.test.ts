import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectLocalBrowserSetup } from "../src/infrastructure/browser/local-browser-setup-detector.js";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function project(manifest?: object) {
  const dir = await mkdtemp(join(tmpdir(), "awenes-browser-setup-"));
  dirs.push(dir);
  if (manifest) await writeFile(join(dir, "package.json"), JSON.stringify(manifest));
  return dir;
}

describe("localhost browser setup detection", () => {
  it("suggests a Vite dev command and localhost URL without starting it", async () => {
    const root = await project({ packageManager: "pnpm@11.0.0", scripts: { dev: "vite --port 4300" } });
    const result = await detectLocalBrowserSetup(root);
    expect(result).toMatchObject({ baseUrl: "http://localhost:4300", healthCheckUrl: "http://localhost:4300" });
    if (process.platform === "win32") {
      expect(result.startCommand).toMatch(/node\.exe$/i);
      expect(result.startArgs.at(-1)).toBe("dev");
    } else expect(result).toMatchObject({ startCommand: "pnpm", startArgs: ["dev"] });
  });
  it("flags multiple scripts for developer review", async () => {
    const root = await project({ scripts: { dev: "next dev", start: "next start" } });
    const result = await detectLocalBrowserSetup(root);
    expect(result.scriptOptions).toEqual(["dev", "start"]);
    expect(result.warnings.join(" ")).toContain("Several server scripts");
  });
  it("falls back to manual setup for non-Node projects", async () => {
    const result = await detectLocalBrowserSetup(await project());
    expect(result.startCommand).toBe("");
    expect(result.baseUrl).toBe("");
    expect(result.warnings.join(" ")).toContain("package.json");
  });
  it("explains when no browser executable is available", async () => {
    const root = await project({ scripts: { dev: "vite" } });
    const result = await detectLocalBrowserSetup(root, [join(root, "missing-browser.exe")]);
    expect(result.browserExecutable).toBe("");
    expect(result.warnings.join(" ")).toContain("Chrome or Edge was not found");
  });
});
