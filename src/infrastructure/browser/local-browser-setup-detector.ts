import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { BrowserSetupSuggestion } from "../../domain/browser-test.js";

const PackageManifestSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
  packageManager: z.string().optional(),
});

export async function detectLocalBrowserSetup(root: string, browserCandidates?: string[]): Promise<BrowserSetupSuggestion> {
  const warnings: string[] = [];
  let scripts: Record<string, string> = {};
  let packageManager = "";
  try {
    const raw = await readFile(join(root, "package.json"), "utf8");
    const manifest = PackageManifestSchema.parse(JSON.parse(raw));
    scripts = manifest.scripts ?? {};
    packageManager = manifest.packageManager?.split("@")[0] ?? "";
  } catch {
    warnings.push("No readable package.json was found. Enter your server command and URL manually.");
  }
  const scriptOptions = ["dev", "start", "serve"].filter((name) => Boolean(scripts[name]));
  const selected = scriptOptions[0];
  if (scriptOptions.length > 1) warnings.push("Several server scripts were found. Confirm which one starts this app.");
  if (!selected && Object.keys(scripts).length) warnings.push("No common server script was found. Enter the command manually.");
  if (!packageManager) {
    for (const [file, value] of [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"], ["bun.lock", "bun"], ["bun.lockb", "bun"]] as const) {
      try { await access(join(root, file)); packageManager = value; break; } catch { /* check next lockfile */ }
    }
  }
  if (!packageManager && selected) packageManager = "npm";
  const script = selected ? scripts[selected] ?? "" : "";
  const portFlag = script.match(/(?:--port(?:=|\s+)|-p\s+)(\d{2,5})(?:\s|$)/);
  const port = portFlag ? Number(portFlag[1]) : /(?:^|\s)(?:vite|next)(?:\s|$)/.test(script) ? (/next/.test(script) ? 3000 : 5173) : /(?:^|\s)astro(?:\s|$)/.test(script) ? 4321 : null;
  if (!port) warnings.push("The server port could not be detected. Confirm the localhost URL before saving.");
  const browsers = browserCandidates ?? (process.platform === "win32" ? [
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  ] : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"]);
  let browserExecutable = "";
  for (const candidate of browsers) {
    try { await access(candidate, constants.X_OK); browserExecutable = candidate; break; } catch { /* check next browser */ }
  }
  if (!browserExecutable) warnings.push("Chrome or Edge was not found. Select an installed browser executable.");
  let startCommand = packageManager && selected ? packageManager : "";
  let startArgs = selected ? packageManager === "npm" ? ["run", selected] : [selected] : [];
  if (selected && process.platform === "win32") {
    const runner = await nodePackageRunner(packageManager);
    if (runner) {
      startCommand = runner.node;
      startArgs = [runner.script, ...(runner.manager === "npm" ? ["run", selected] : [selected])];
      if (runner.manager !== packageManager) warnings.push(`Using the installed npm runner for this ${packageManager} project. Confirm that its dependencies are installed.`);
    } else {
      startCommand = "";
      startArgs = [];
      warnings.push("A directly runnable Node package manager was not found. Enter an executable command manually.");
    }
  }
  const baseUrl = port ? `http://localhost:${port}` : "";
  return {
    startCommand,
    startArgs,
    baseUrl,
    healthCheckUrl: baseUrl,
    browserExecutable,
    scriptOptions,
    warnings,
  };
}

async function nodePackageRunner(manager: string): Promise<{ node: string; script: string; manager: string } | null> {
  const paths = [dirname(process.execPath), ...(process.env.PATH ?? "").split(";")].filter(Boolean);
  for (const root of paths) {
    const node = join(root, "node.exe");
    try { await access(node, constants.X_OK); } catch { continue; }
    for (const [name, entry] of [[manager, manager === "pnpm" ? "pnpm/bin/pnpm.mjs" : manager === "npm" ? "npm/bin/npm-cli.js" : ""], ["npm", "npm/bin/npm-cli.js"]] as const) {
      if (!entry) continue;
      const script = join(root, "node_modules", entry);
      try { await access(script, constants.R_OK); return { node, script, manager: name }; } catch { /* check fallback */ }
    }
  }
  return null;
}
