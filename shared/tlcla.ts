import type {
  AnalyticsProps,
  ExportResult,
  LogFileInfo,
  ParsedLogSummary,
  TelemetryPublicConfig,
  TelemetrySettings,
  UpdateStatusPayload,
} from "./types";

export type LogsApi = {
  getDefaultDirectories: () => Promise<string[]>;
  selectDirectory: () => Promise<string | null>;
  listFiles: (directory: string) => Promise<LogFileInfo[]>;
  parseSummary: (filePath: string) => Promise<ParsedLogSummary>;
};

export type WindowControlsApi = {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
};

export type AppApi = {
  getVersion: () => Promise<string>;
};

export type UpdatesApi = {
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onStatus: (callback: (status: UpdateStatusPayload) => void) => () => void;
};

export type ExportApi = {
  savePng: (suggestedFileName?: string) => Promise<ExportResult>;
};

export type TelemetryApi = {
  getSettings: () => Promise<TelemetrySettings>;
  setSettings: (next: Partial<TelemetrySettings>) => Promise<TelemetrySettings>;
  getConfig: () => Promise<TelemetryPublicConfig>;
};

export type AnalyticsApi = {
  trackUsage: (eventName: string, props?: AnalyticsProps) => Promise<void>;
};

export type TlclaApi = {
  logs: LogsApi;
  window: WindowControlsApi;
  app: AppApi;
  updates: UpdatesApi;
  export: ExportApi;
  telemetry: TelemetryApi;
  analytics: AnalyticsApi;
};

