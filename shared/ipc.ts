export const IPC = {
  APP_GET_VERSION: "app:getVersion",

  LOGS_GET_DEFAULT_DIRECTORIES: "logs:getDefaultDirectories",
  LOGS_SELECT_DIRECTORY: "logs:selectDirectory",
  LOGS_LIST_FILES: "logs:listFiles",
  LOGS_PARSE_SUMMARY: "logs:parseSummary",
  LOGS_DELETE_FILE: "logs:deleteFile",

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
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
