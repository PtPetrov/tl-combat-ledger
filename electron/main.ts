// electron/main/main.ts
import { app, BrowserWindow, ipcMain, dialog, screen, Menu } from "electron";
import type { Display } from "electron";
import * as path from "path";
import * as url from "url";
import * as fs from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { autoUpdater } from "electron-updater";

import { IPC } from "../shared/ipc";
import type {
  ExportResult,
  ParsedLogSummary,
  UpdateStatusPayload,
} from "../shared/types";
import { getDefaultLogDirectories, listLogFilesInDirectory } from "./logs";
import { getTelemetrySettings, setTelemetrySettings } from "./telemetry";
import { getAptabaseAppKey, getSentryDsn } from "./telemetryConfig";
import { trackUsageEvent } from "./analytics";

let mainWindow: BrowserWindow | null = null;
let ipcRegistered = false;

const isDev = !app.isPackaged;
const isWsl =
  process.platform === "linux" &&
  (Boolean(process.env.WSL_DISTRO_NAME) ||
    Boolean(process.env.WSL_INTEROP) ||
    Boolean(process.env.WSLENV));

// WSL2 commonly fails to initialize Electron's GPU process, which can result in a blank
// window or degraded rendering. Prefer software rendering in that environment.
if (isWsl) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}

const workerScript = path.join(__dirname, "logWorker.js");
const lockInspector = !isDev;

const KNOWN_USAGE_EVENT_NAMES: Record<string, string> = {
  "app.started": "App Started",
  "log.opened": "Log Opened",
  "log.parse.started": "Log Parse Started",
  "log.parse.succeeded": "Log Parse Succeeded",
  "log.parse.failed": "Log Parse Failed",
  "logs.folder.select_opened": "Select Log Folder Opened",
  "logs.folder.selected": "Log Folder Selected",
  "logs.folder.select_canceled": "Select Log Folder Canceled",
  "logs.refresh": "Refresh Logs",
  "compare.enabled": "Compare Enabled",
  "compare.disabled": "Compare Disabled",
  "export.png": "Export PNG",
  "update.check.auto": "Update Check (Auto)",
  "update.check.manual": "Update Check (Manual)",
  "update.install": "Update Install",
  "telemetry.test": "Telemetry Test",
};

const humanizeUsageEventName = (raw: string): string => {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "Unknown Event";
  const known = KNOWN_USAGE_EVENT_NAMES[trimmed];
  if (known) return known;

  const parts = trimmed
    .replace(/[_/]+/g, " ")
    .split(".")
    .flatMap((p) => p.split(/\s+/g))
    .filter(Boolean);

  if (parts.length === 0) return "Unknown Event";

  const words = parts.map((part) => {
    const lower = part.toLowerCase();
    if (["png", "csv", "json", "ui", "ipc", "dps", "hps"].includes(lower)) {
      return lower.toUpperCase();
    }
    return lower.length <= 3
      ? lower.toUpperCase()
      : lower[0].toUpperCase() + lower.slice(1);
  });

  return words.join(" ").slice(0, 80);
};

function getRecommendedZoomFactor(display: Display): number {
  const effectiveHeight = Math.round(display.workAreaSize.height);

  // Target: scale UI down on smaller *effective* displays (DIP) so more fits onscreen.
  // Use height-based thresholds so ultrawide (e.g. 2560x1080) behaves as expected.
  // Note: Using workAreaSize (not physical pixels) accounts for OS display scaling.
  if (effectiveHeight <= 1080) return 0.85;
  if (effectiveHeight <= 1440) return 0.9;
  if (effectiveHeight <= 1600) return 0.95;
  return 1;
}

const gotInstanceLock = app.requestSingleInstanceLock();

if (!gotInstanceLock) {
  app.quit();
}

/**
 * Create the main application window.
 * Rendering is handled by the React app in the renderer bundle.
 */
function createMainWindow() {
  const AREA_SCALE = Math.sqrt(0.5); // ~50% of screen area

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width: workWidth, height: workHeight } = display.workArea;
  const zoomFactor = getRecommendedZoomFactor(display);

  const maxWidth = Math.round(workWidth * AREA_SCALE);
  const maxHeight = Math.round(workHeight * AREA_SCALE);

  const defaultWidth = maxWidth;
  const defaultHeight = maxHeight;

  const x = Math.round(display.workArea.x + (workWidth - defaultWidth) / 2);
  const y = Math.round(display.workArea.y + (workHeight - defaultHeight) / 2);

  const requestedMinWidth = 960;
  const requestedMinHeight = 540;
  let minWidth = Math.min(requestedMinWidth, workWidth);
  const minHeight = Math.min(requestedMinHeight, workHeight);

  // Resolve icon for window/taskbar (dev uses local resources, prod uses packaged resources).
  const resourcesPath = isDev
    ? path.join(app.getAppPath(), "resources")
    : process.resourcesPath;
  const iconPath = path.join(resourcesPath, "icon.ico");

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x,
    y,
    minWidth,
    minHeight,
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
      devTools: !lockInspector,
      zoomFactor,
    },
  });

  // Hide application menu / menu bar to remove any devtools entry points.
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  const appUrl = isDev
    ? "http://localhost:5173"
    : url.format({
        pathname: path.join(__dirname, "..", "renderer", "index.html"),
        protocol: "file:",
        slashes: true,
      });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(appUrl)) {
      event.preventDefault();
    }
  });

  if (lockInspector) {
    // Disable right-click context menu to prevent "Inspect Element".
    mainWindow.webContents.on("context-menu", (event) => {
      event.preventDefault();
    });

    // Block common devtools / inspect shortcuts.
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      const key = (input.key || "").toLowerCase();

      if (key === "f12") {
        event.preventDefault();
        return;
      }

      const ctrlOrCmd =
        process.platform === "darwin" ? input.meta : input.control;

      // Ctrl/Cmd+Shift+I/J/C/K (Chrome/Edge/Firefox devtools)
      if (ctrlOrCmd && input.shift && ["i", "j", "c", "k"].includes(key)) {
        event.preventDefault();
        return;
      }

      // Cmd+Option+I/J/C (macOS)
      if (input.meta && input.alt && ["i", "j", "c"].includes(key)) {
        event.preventDefault();
        return;
      }

      // View source (Ctrl/Cmd+U) and other quick entry points.
      if (ctrlOrCmd && key === "u") {
        event.preventDefault();
      }
    });

    // If anything manages to open devtools, immediately close it.
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.loadURL(appUrl);

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    ensureWindowWithinWorkArea();
    applyZoomForCurrentDisplay();
    mainWindow.show();
    mainWindow.focus();
  });

  const ensureWindowWithinWorkArea = () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized() || mainWindow.isFullScreen()) return;
    const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    const workArea = currentDisplay.workArea;

    const bounds = mainWindow.getBounds();
    let width = bounds.width;
    let height = bounds.height;

    if (width > workArea.width || height > workArea.height) {
      const scale = Math.min(workArea.width / width, workArea.height / height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }

    let nextX = bounds.x;
    let nextY = bounds.y;

    const maxX = workArea.x + workArea.width - width;
    const maxY = workArea.y + workArea.height - height;

    nextX = Math.min(Math.max(nextX, workArea.x), maxX);
    nextY = Math.min(Math.max(nextY, workArea.y), maxY);

    if (
      nextX !== bounds.x ||
      nextY !== bounds.y ||
      width !== bounds.width ||
      height !== bounds.height
    ) {
      mainWindow.setBounds({ x: nextX, y: nextY, width, height });
    }
  };

  const applyZoomForCurrentDisplay = () => {
    if (!mainWindow) return;
    const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    const nextZoom = getRecommendedZoomFactor(currentDisplay);
    const currentZoom = mainWindow.webContents.getZoomFactor();
    if (Math.abs(currentZoom - nextZoom) < 0.001) return;
    mainWindow.webContents.setZoomFactor(nextZoom);
  };

  mainWindow.on("unmaximize", () => {
    ensureWindowWithinWorkArea();
  });
  mainWindow.on("leave-full-screen", () => {
    ensureWindowWithinWorkArea();
  });

  let zoomUpdateTimer: NodeJS.Timeout | null = null;
  const scheduleApplyZoom = () => {
    if (zoomUpdateTimer) clearTimeout(zoomUpdateTimer);
    zoomUpdateTimer = setTimeout(() => {
      zoomUpdateTimer = null;
      ensureWindowWithinWorkArea();
      applyZoomForCurrentDisplay();
    }, 150);
  };

  // Keep scaling correct if the window is moved between monitors.
  mainWindow.on("move", scheduleApplyZoom);
  mainWindow.on("resize", scheduleApplyZoom);

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
  mainWindow.webContents.send(IPC.UPDATES_STATUS, payload);
}

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
    sendUpdateStatus({
      state: "error",
      message: "Updates unavailable in development",
    });
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

  ipcMain.handle(IPC.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC.LOGS_GET_DEFAULT_DIRECTORIES, () => {
    return getDefaultLogDirectories();
  });

  ipcMain.handle(IPC.LOGS_SELECT_DIRECTORY, async () => {
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

  ipcMain.handle(IPC.LOGS_LIST_FILES, async (_event, directory: string) => {
    if (!directory || typeof directory !== "string") return [];
    return listLogFilesInDirectory(directory);
  });

  ipcMain.handle(IPC.LOGS_PARSE_SUMMARY, async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("filePath is required for logs:parseSummary");
    }
    return parseSummaryInWorker(filePath);
  });

  ipcMain.handle(IPC.UPDATES_CHECK, async () => {
    await triggerUpdateCheck();
  });

  ipcMain.handle(IPC.UPDATES_INSTALL, () => {
    if (isDev) return;
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle(
    IPC.EXPORT_PNG,
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
          defaultPath: buildDefaultExportPath(
            payload?.suggestedFileName,
            "png"
          ),
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

  ipcMain.handle(IPC.TELEMETRY_GET_SETTINGS, () => {
    return getTelemetrySettings();
  });

  ipcMain.handle(IPC.TELEMETRY_GET_CONFIG, () => {
    const sentryDsn = getSentryDsn();
    return { sentryDsn: sentryDsn || undefined };
  });

  ipcMain.handle(
    IPC.TELEMETRY_SET_SETTINGS,
    (_event, update: { crashReportsEnabled?: boolean }) => {
      return setTelemetrySettings(update);
    }
  );

  ipcMain.handle(
    IPC.ANALYTICS_TRACK_USAGE,
    (
      _event,
      payload: {
        eventName: string;
        props?: Record<string, string | number | boolean>;
      }
    ) => {
      if (!payload?.eventName || typeof payload.eventName !== "string") return;
      if (!getAptabaseAppKey()) return;
      void trackUsageEvent(
        humanizeUsageEventName(payload.eventName),
        payload.props
      ).catch((error) => {
        if (!isDev) return;
        console.warn("Failed to send Aptabase usage event", error);
      });
    }
  );

  // Frameless window controls, used by TopBar via preload.ts
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on(IPC.WINDOW_TOGGLE_MAXIMIZE, () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      mainWindow.focus();
      return;
    }

    mainWindow.maximize();
  });

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
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
    if (lockInspector) {
      Menu.setApplicationMenu(null);
    }
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
