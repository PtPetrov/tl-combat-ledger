#!/usr/bin/env node
/**
 * Local dev runner:
 * - starts Vite dev server
 * - watches/compiles Electron + shared via `tsc -w`
 * - launches Electron and restarts it when the compiled output changes
 *
 * No external deps (works in WSL2).
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import process from "node:process";

const ROOT = process.cwd();
const DIST_ELECTRON_MAIN = path.join(ROOT, "dist", "electron", "main.js");

const isWsl = () => {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try {
    const version = fs.readFileSync("/proc/version", "utf8");
    return /microsoft/i.test(version);
  } catch {
    return false;
  }
};

const ELECTRON_BIN = (() => {
  const bin = process.platform === "win32" ? "electron.cmd" : "electron";
  return path.join(ROOT, "node_modules", ".bin", bin);
})();

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const children = new Set();
let electronProc = null;
let restartTimer = null;

const spawnChild = (cmd, args, opts = {}) => {
  const child = spawn(cmd, args, { stdio: "inherit", ...opts });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const waitForFile = async (filePath, timeoutMs = 60_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
};

const waitForHttpOk = async (url, timeoutMs = 60_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const killProcess = async (proc, label) => {
  if (!proc || proc.killed) return;
  proc.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((r) => proc.once("exit", () => r(true))),
    delay(1500).then(() => false),
  ]);
  if (!exited) {
    try {
      proc.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
};

const startElectron = () => {
  const args = ["."];
  if (isWsl()) {
    // WSL2 commonly fails GPU init; this makes the window render reliably.
    args.push("--disable-gpu");
  }

  electronProc = spawnChild(ELECTRON_BIN, args, {
    env: { ...process.env },
  });
};

const scheduleElectronRestart = () => {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(async () => {
    restartTimer = null;
    await killProcess(electronProc, "electron");
    startElectron();
  }, 250);
};

const main = async () => {
  // Start renderer (Vite) and Electron compiler watch.
  spawnChild(npmCmd, ["run", "dev:renderer"]);
  spawnChild(npmCmd, ["run", "build:electron", "--", "--watch"]);

  // Wait for both the dev server and the compiled main entry.
  await Promise.all([
    waitForHttpOk("http://127.0.0.1:5173"),
    waitForFile(DIST_ELECTRON_MAIN),
  ]);

  startElectron();

  // Restart Electron when compiled output changes.
  const watchDirs = [
    path.join(ROOT, "dist", "electron"),
    path.join(ROOT, "dist", "shared"),
  ];

  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: false }, (_event, filename) => {
      if (!filename) return;
      if (!filename.endsWith(".js") && !filename.endsWith(".map")) return;
      scheduleElectronRestart();
    });
  }
};

const shutdown = async (code = 0) => {
  await killProcess(electronProc, "electron");
  await Promise.allSettled([...children].map((c) => killProcess(c, "child")));
  process.exit(code);
};

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("uncaughtException", (err) => {
  console.error(err);
  void shutdown(1);
});
process.on("unhandledRejection", (err) => {
  console.error(err);
  void shutdown(1);
});

await main();
