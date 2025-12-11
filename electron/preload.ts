import { contextBridge, ipcRenderer } from "electron";

type LogFileInfo = {
  name: string;
  path: string;
  size: number;
  modifiedAt: number;
};

type SkillBreakdown = {
  skillName: string;
  totalHits: number;
  totalDamage: number;
  maxHit: number;
  avgHit: number;
  critHits: number;
  critRate: number;
};

type TargetBreakdown = {
  targetName: string;
  totalHits: number;
  totalDamage: number;
  maxHit: number;
  avgHit: number;
  critHits: number;
  critRate: number;
};

type DamageTimelineBucket = {
  timestampMs: number;
  elapsedSeconds: number;
  totalDamage: number;
  perTarget: Record<string, number>;
};

type PerTargetSkillsMap = Record<string, SkillBreakdown[]>;

type ParsedLogSummary = {
  filePath: string;
  fileName: string;
  characterName: string | null;
  totalEvents: number;
  durationSeconds: number | null;
  startTime: string | null;
  endTime: string | null;
  totalDamage: number;
  totalHealing: number;
  dps: number | null;
  hps: number | null;
  critRate: number | null;
  skills: SkillBreakdown[];
  targets: TargetBreakdown[];
  perTargetSkills: PerTargetSkillsMap;
  timeline: DamageTimelineBucket[];
};

type UpdateStatusPayload = {
  state: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  version?: string;
  percent?: number;
  message?: string;
};

const logsApi = {
  getDefaultDirectories(): Promise<string[]> {
    return ipcRenderer.invoke("logs:getDefaultDirectories");
  },
  selectDirectory(): Promise<string | null> {
    return ipcRenderer.invoke("logs:selectDirectory");
  },
  listFiles(directory: string): Promise<LogFileInfo[]> {
    return ipcRenderer.invoke("logs:listFiles", directory);
  },
  parseSummary(filePath: string): Promise<ParsedLogSummary> {
    return ipcRenderer.invoke("logs:parseSummary", filePath);
  },
};

const windowApi = {
  minimize() {
    ipcRenderer.send("window:minimize");
  },
  toggleMaximize() {
    ipcRenderer.send("window:toggleMaximize");
  },
  close() {
    ipcRenderer.send("window:close");
  },
};

const appApi = {
  getVersion(): Promise<string> {
    return ipcRenderer.invoke("app:getVersion");
  },
};

const updatesApi = {
  checkForUpdates(): Promise<void> {
    return ipcRenderer.invoke("updates:check");
  },
  installUpdate(): Promise<void> {
    return ipcRenderer.invoke("updates:install");
  },
  onStatus(callback: (payload: UpdateStatusPayload) => void) {
    const handler = (_event: unknown, payload: UpdateStatusPayload) => {
      callback(payload);
    };
    ipcRenderer.on("updates:status", handler);
    return () => ipcRenderer.removeListener("updates:status", handler);
  },
};

contextBridge.exposeInMainWorld("tlcla", {
  logs: logsApi,
  window: windowApi,
  app: appApi,
  updates: updatesApi,
});

export {};
