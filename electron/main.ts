// electron/main/main.ts
import { app, BrowserWindow, ipcMain, dialog, screen } from "electron";
import * as path from "path";
import * as url from "url";
import { Worker } from "node:worker_threads";
import { autoUpdater } from "electron-updater";

import {
  getDefaultLogDirectories,
  listLogFilesInDirectory,
} from "./logs";
import type { ParsedLogSummary } from "./logs";

let mainWindow: BrowserWindow | null = null;
let ipcRegistered = false;

const isDev = !app.isPackaged;
const workerScript = path.join(__dirname, "logWorker.js");

type UpdateStatusPayload = {
  state: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  version?: string;
  percent?: number;
  message?: string;
};

const gotInstanceLock = app.requestSingleInstanceLock();

if (!gotInstanceLock) {
  app.quit();
}

/**
 * Create the main application window.
 * Rendering is handled by the React app in the renderer bundle.
 */
function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    useContentSize: false,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor: "#050814",
    title: "TL Combat Ledger",
    frame: false, // custom top bar
    titleBarStyle: "hidden",
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // small extra hardening
      devTools: isDev,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, "renderer/index.html"),
        protocol: "file:",
        slashes: true,
      })
    );
  }

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
    // Start fullscreen by default; custom maximize control will toggle out.
    mainWindow.setFullScreen(true);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function parseSummaryInWorker(filePath: string): Promise<ParsedLogSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerScript, {
      workerData: { filePath },
    });

    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      handler();
    };

    worker.once("message", (message: any) => {
      worker.terminate();
      if (message?.status === "success") {
        finish(() => resolve(message.summary as ParsedLogSummary));
      } else {
        const error = new Error(
          message?.error || "Log worker failed to parse summary"
        );
        finish(() => reject(error));
      }
    });

    worker.once("error", (err) => {
      worker.terminate();
      finish(() => reject(err));
    });

    worker.once("exit", (code) => {
      if (code !== 0) {
        const err = new Error(`Log worker exited with code ${code}`);
        finish(() => reject(err));
      }
    });
  });
}

function sendUpdateStatus(payload: UpdateStatusPayload) {
  if (!mainWindow) return;
  mainWindow.webContents.send("updates:status", payload);
}

async function triggerUpdateCheck() {
  if (isDev) {
    sendUpdateStatus({ state: "error", message: "Updates unavailable in development" });
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendUpdateStatus({ state: "error", message });
  }
}

function initAutoUpdater() {
  if (isDev) {
    console.info("Auto-updater disabled in development mode");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.logger = console as any;
  sendUpdateStatus({ state: "idle" });

  autoUpdater.on("checking-for-update", () => {
    console.info("Checking for updates");
    sendUpdateStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    console.info("Update available. Downloading...");
    sendUpdateStatus({ state: "available", version: info?.version });
  });

  autoUpdater.on("update-not-available", () => {
    console.info("No updates available");
    sendUpdateStatus({ state: "idle" });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({
      state: "downloading",
      percent: progress?.percent,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.info("Update downloaded. It will install on next restart.");
    sendUpdateStatus({ state: "ready", version: info?.version });
  });

  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error", error);
    sendUpdateStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });

  void triggerUpdateCheck();
}

/* ------------------------------------------------------------------ */
/* IPC setup                                                          */
/* ------------------------------------------------------------------ */

function registerIpcHandlers() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  ipcMain.handle("logs:getDefaultDirectories", () => {
    return getDefaultLogDirectories();
  });

  ipcMain.handle("logs:selectDirectory", async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select TL combat log folder",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("logs:listFiles", async (_event, directory: string) => {
    if (!directory || typeof directory !== "string") return [];
    return listLogFilesInDirectory(directory);
  });

  ipcMain.handle("logs:parseSummary", async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("filePath is required for logs:parseSummary");
    }
    return parseSummaryInWorker(filePath);
  });

  ipcMain.handle("updates:check", async () => {
    await triggerUpdateCheck();
  });

  ipcMain.handle("updates:install", () => {
    if (isDev) return;
    autoUpdater.quitAndInstall();
  });

  // Frameless window controls, used by TopBar via preload.ts
  ipcMain.on("window:minimize", () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on("window:toggleMaximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isFullScreen()) {
      const { workArea } = screen.getPrimaryDisplay();
      const targetWidth = Math.round(workArea.width * 0.5);
      const targetHeight = Math.round(workArea.height * 0.5);
      const targetX =
        workArea.x + Math.round((workArea.width - targetWidth) / 2);
      const targetY =
        workArea.y + Math.round((workArea.height - targetHeight) / 2);

      mainWindow.setFullScreen(false);
      mainWindow.setBounds({
        x: targetX,
        y: targetY,
        width: targetWidth,
        height: targetHeight,
      });
      mainWindow.focus();
      return;
    }

    mainWindow.setFullScreen(true);
  });

  ipcMain.on("window:close", () => {
    if (mainWindow) mainWindow.close();
  });
}

/* ------------------------------------------------------------------ */
/* App lifecycle                                                      */
/* ------------------------------------------------------------------ */

if (gotInstanceLock) {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createMainWindow();
    initAutoUpdater();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createMainWindow();
    }
  });
}
