import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const temporaryRoot = await mkdtemp(join(tmpdir(), "awenes-desktop-smoke-"));
const screenshotPath = join(temporaryRoot, "launch.png");
const databasePath = join(temporaryRoot, "smoke.db");
const electronPath = resolve("node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");

try {
  const exitCode = await launch(electronPath, screenshotPath, databasePath);
  if (exitCode !== 0) throw new Error(`AwenesOS desktop exited with code ${exitCode}`);
  const screenshot = await readFile(screenshotPath);
  const pngSignature = "89504e470d0a1a0a";
  if (screenshot.subarray(0, 8).toString("hex") !== pngSignature) throw new Error("Desktop launch did not produce a valid PNG screenshot");
  console.log(`Desktop smoke test passed (${screenshot.length} byte render)`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function launch(executable, screenshot, database) {
  return new Promise((resolveExit, reject) => {
    const desktopEnvironment = { ...process.env, AWENES_DB_PATH: database };
    delete desktopEnvironment.ELECTRON_RUN_AS_NODE;
    const child = spawn(executable, [`--user-data-dir=${join(dirname(screenshot), "electron-profile")}`, "--disable-gpu", ".", `capture=${screenshot}`], {
      cwd: process.cwd(),
      env: desktopEnvironment,
      stdio: "inherit",
      windowsHide: true,
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Desktop smoke test timed out after 30 seconds"));
    }, 30_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code ?? 1);
    });
  });
}
