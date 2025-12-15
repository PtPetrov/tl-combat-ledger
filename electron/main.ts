// electron/main/main.ts
import { app, BrowserWindow, ipcMain, dialog, screen } from "electron";
import * as path from "path";
import * as url from "url";
import * as fs from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { autoUpdater } from "electron-updater";

import {
  getDefaultLogDirectories,
  listLogFilesInDirectory,
} from "./logs";
import type { ParsedLogSummary } from "./logs";
import { getTelemetrySettings, setTelemetrySettings } from "./telemetry";
import { trackUsageEvent } from "./analytics";

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
  const ASPECT_RATIO = 16 / 9;
  const AREA_SCALE = Math.sqrt(0.5); // ~50% of screen area

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width: workWidth, height: workHeight } = display.workArea;

  const maxWidth = Math.round(workWidth * AREA_SCALE);
  const maxHeight = Math.round(workHeight * AREA_SCALE);

  let defaultWidth = maxWidth;
  let defaultHeight = Math.round(defaultWidth / ASPECT_RATIO);

  if (defaultHeight > maxHeight) {
    defaultHeight = maxHeight;
    defaultWidth = Math.round(defaultHeight * ASPECT_RATIO);
  }

  // Resolve icon for window/taskbar (dev uses local resources, prod uses packaged resources).
  const resourcesPath = isDev
    ? path.join(__dirname, "..", "resources")
    : process.resourcesPath;
  const iconPath = path.join(resourcesPath, "icon.ico");

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth: defaultWidth,
    minHeight: defaultHeight,
    center: true,
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
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // small extra hardening
      devTools: isDev,
    },
  });

  // Lock window resizing to a 16:9 aspect ratio.
  mainWindow.setAspectRatio(ASPECT_RATIO);

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

type ExportResult = {
  canceled: boolean;
  filePath?: string;
  error?: string;
};

const sanitizeBaseFileName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "TL Combat Ledger";
  return trimmed
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .trim();
};

const buildDefaultExportPath = (suggestedFileName: unknown, ext: string) => {
  const base =
    typeof suggestedFileName === "string"
      ? sanitizeBaseFileName(suggestedFileName)
      : "TL Combat Ledger";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${base} - ${stamp}.${ext}`;
  return path.join(app.getPath("downloads"), fileName);
};

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

  ipcMain.handle(
    "export:png",
    async (
      _event,
      payload?: {
        suggestedFileName?: string;
      }
    ): Promise<ExportResult> => {
      if (!mainWindow) return { canceled: true, error: "No active window" };

      try {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Export view as PNG",
          defaultPath: buildDefaultExportPath(payload?.suggestedFileName, "png"),
          filters: [{ name: "PNG Image", extensions: ["png"] }],
        });

        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        const image = await mainWindow.webContents.capturePage();
        await fs.writeFile(result.filePath, image.toPNG());
        return { canceled: false, filePath: result.filePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dialog.showErrorBox("Export failed", message);
        return { canceled: true, error: message };
      }
    }
  );

  ipcMain.handle("telemetry:getSettings", () => {
    return getTelemetrySettings();
  });

  ipcMain.handle(
    "telemetry:setSettings",
    (
      _event,
      update: { crashReportsEnabled?: boolean; usageStatsEnabled?: boolean }
    ) => {
      return setTelemetrySettings(update);
    }
  );

  ipcMain.handle(
    "analytics:trackUsage",
    async (
      _event,
      payload: {
        eventName: string;
        props?: Record<string, string | number | boolean>;
      }
    ) => {
      if (!payload?.eventName || typeof payload.eventName !== "string") return;
      const settings = getTelemetrySettings();
      if (!settings.usageStatsEnabled) return;
      await trackUsageEvent(payload.eventName, payload.props);
    }
  );

  // Frameless window controls, used by TopBar via preload.ts
  ipcMain.on("window:minimize", () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on("window:toggleMaximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      mainWindow.focus();
      return;
    }

    mainWindow.maximize();
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
