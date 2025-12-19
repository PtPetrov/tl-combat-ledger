import { contextBridge, ipcRenderer } from "electron";
import type {
  AnalyticsProps,
  ExportResult,
  LogFileInfo,
  ParsedLogSummary,
  TelemetryPublicConfig,
  TelemetrySettings,
  UpdateStatusPayload,
} from "../shared/types";
import type { TlclaApi } from "../shared/tlcla";

// NOTE: With `webPreferences.sandbox: true`, preload scripts have a restricted
// environment. Keep this file self-contained at runtime (avoid importing local
// modules) to ensure the bridge is available in all environments (e.g. WSL2).
type IpcContract = typeof import("../shared/ipc").IPC;
const IPC = {
  APP_GET_VERSION: "app:getVersion",

  LOGS_GET_DEFAULT_DIRECTORIES: "logs:getDefaultDirectories",
  LOGS_SELECT_DIRECTORY: "logs:selectDirectory",
  LOGS_LIST_FILES: "logs:listFiles",
  LOGS_PARSE_SUMMARY: "logs:parseSummary",

  UPDATES_CHECK: "updates:check",
  UPDATES_INSTALL: "updates:install",
  UPDATES_STATUS: "updates:status",

  EXPORT_PNG: "export:png",

  TELEMETRY_GET_SETTINGS: "telemetry:getSettings",
  TELEMETRY_SET_SETTINGS: "telemetry:setSettings",
  TELEMETRY_GET_CONFIG: "telemetry:getConfig",

  ANALYTICS_TRACK_USAGE: "analytics:trackUsage",

  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_TOGGLE_MAXIMIZE: "window:toggleMaximize",
  WINDOW_CLOSE: "window:close",
} as const satisfies IpcContract;

const logsApi = {
  getDefaultDirectories(): Promise<string[]> {
    return ipcRenderer.invoke(IPC.LOGS_GET_DEFAULT_DIRECTORIES);
  },
  selectDirectory(): Promise<string | null> {
    return ipcRenderer.invoke(IPC.LOGS_SELECT_DIRECTORY);
  },
  listFiles(directory: string): Promise<LogFileInfo[]> {
    return ipcRenderer.invoke(IPC.LOGS_LIST_FILES, directory);
  },
  parseSummary(filePath: string): Promise<ParsedLogSummary> {
    return ipcRenderer.invoke(IPC.LOGS_PARSE_SUMMARY, filePath);
  },
};

const windowApi = {
  minimize() {
    ipcRenderer.send(IPC.WINDOW_MINIMIZE);
  },
  toggleMaximize() {
    ipcRenderer.send(IPC.WINDOW_TOGGLE_MAXIMIZE);
  },
  close() {
    ipcRenderer.send(IPC.WINDOW_CLOSE);
  },
};

const appApi = {
  getVersion(): Promise<string> {
    return ipcRenderer.invoke(IPC.APP_GET_VERSION);
  },
};

const updatesApi = {
  checkForUpdates(): Promise<void> {
    return ipcRenderer.invoke(IPC.UPDATES_CHECK);
  },
  installUpdate(): Promise<void> {
    return ipcRenderer.invoke(IPC.UPDATES_INSTALL);
  },
  onStatus(callback: (payload: UpdateStatusPayload) => void) {
    const handler = (_event: unknown, payload: UpdateStatusPayload) => {
      callback(payload);
    };
    ipcRenderer.on(IPC.UPDATES_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC.UPDATES_STATUS, handler);
  },
};

const exportApi = {
  savePng(suggestedFileName?: string): Promise<ExportResult> {
    return ipcRenderer.invoke(IPC.EXPORT_PNG, { suggestedFileName });
  },
};

const telemetryApi = {
  getSettings(): Promise<TelemetrySettings> {
    return ipcRenderer.invoke(IPC.TELEMETRY_GET_SETTINGS);
  },
  setSettings(
    next: Partial<TelemetrySettings>
  ): Promise<TelemetrySettings> {
    return ipcRenderer.invoke(IPC.TELEMETRY_SET_SETTINGS, next);
  },
  getConfig(): Promise<TelemetryPublicConfig> {
    return ipcRenderer.invoke(IPC.TELEMETRY_GET_CONFIG);
  },
};

const analyticsApi = {
  trackUsage(eventName: string, props?: AnalyticsProps): Promise<void> {
    return ipcRenderer.invoke(IPC.ANALYTICS_TRACK_USAGE, { eventName, props });
  },
};

const tlcla: TlclaApi = {
  logs: logsApi,
  window: windowApi,
  app: appApi,
  updates: updatesApi,
  export: exportApi,
  telemetry: telemetryApi,
  analytics: analyticsApi,
};

contextBridge.exposeInMainWorld("tlcla", tlcla);

export {};
