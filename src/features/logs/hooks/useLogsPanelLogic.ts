// src/components/logs/useLogsPanelLogic.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DamageTimelineBucket,
  LoadState,
  LogFileInfo,
  ParsedLogSummary,
  SkillBreakdown,
  TargetBreakdown,
  TargetSessionSummary,
} from "../types/logTypes";
import type { UpdatesApi } from "../types/updateTypes";
import { trackUsage } from "../../../telemetry/telemetry";

type LogsApi = {
  getDefaultDirectories: () => Promise<string[]>;
  selectDirectory: () => Promise<string | null>;
  listFiles: (directory: string) => Promise<LogFileInfo[]>;
  parseSummary: (filePath: string) => Promise<ParsedLogSummary>;
};

type AppApi = {
  getVersion: () => Promise<string>;
};

type ExportResult = {
  canceled: boolean;
  filePath?: string;
  error?: string;
};

type ExportApi = {
  savePng: (suggestedFileName?: string) => Promise<ExportResult>;
};

type LogDisplayNameMap = Record<string, string>;
type LogFavoritesMap = Record<string, true>;

export interface TimelineSeries {
  key: string; // data key in chart data
  label: string; // legend label
}

export const OVERALL_TIMELINE_KEY = "__overallDamage";

const LOG_DISPLAY_NAMES_STORAGE_KEY = "tlcla:logDisplayNames";
const LOG_DISPLAY_NAMES_CHANGED_EVENT = "tlcla:logDisplayNamesChanged";
const LOG_FAVORITES_STORAGE_KEY = "tlcla:logFavorites";
const LOG_FAVORITES_CHANGED_EVENT = "tlcla:logFavoritesChanged";

const readLogDisplayNames = (): LogDisplayNameMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOG_DISPLAY_NAMES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as LogDisplayNameMap;
  } catch (error) {
    console.warn("[logs] Failed to read log display names", error);
    return {};
  }
};

const writeLogDisplayNames = (next: LogDisplayNameMap) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOG_DISPLAY_NAMES_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch (error) {
    console.warn("[logs] Failed to persist log display names", error);
  }
  window.dispatchEvent(new Event(LOG_DISPLAY_NAMES_CHANGED_EVENT));
};

const readLogFavorites = (): LogFavoritesMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOG_FAVORITES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    const next: LogFavoritesMap = {};
    for (const [filePath, value] of entries) {
      if (value === true) next[filePath] = true;
    }
    return next;
  } catch (error) {
    console.warn("[logs] Failed to read log favourites", error);
    return {};
  }
};

const writeLogFavorites = (next: LogFavoritesMap) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOG_FAVORITES_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch (error) {
    console.warn("[logs] Failed to persist log favourites", error);
  }
  window.dispatchEvent(new Event(LOG_FAVORITES_CHANGED_EVENT));
};

const getBasenameFromPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : filePath;
};

export interface TimelineSession {
  id: number;
  startElapsed: number;
  endElapsed: number;
  durationSeconds: number;
}

export interface UseLogsPanelLogicResult {
  selectedDir: string | null;
  logs: LogFileInfo[];
  logFavorites: LogFavoritesMap;
  state: LoadState;
  error: string | null;
  hasLogs: boolean;

  selectedLog: LogFileInfo | null;
  summaryState: LoadState;
  summaryError: string | null;
  selectedSummaryTitle: string;
  characterName: string | null;

  overallTotalDamage: number;
  overallTotalEvents: number;
  overallDurationSeconds: number | null;

  selectedTargetName: string | null;
  selectedSessionId: number | null;

  currentTotalDamage: number;
  currentTotalEvents: number;
  currentDps: number | null;
  currentCritRate: number | null;
  currentDurationSeconds: number | null;
  currentTopSkills: SkillBreakdown[];

  targets: TargetBreakdown[];
  topTargets: TargetBreakdown[];

  hasTimeline: boolean;
  timeline: DamageTimelineBucket[];
  timelineSeries: TimelineSeries[];
  timelineSessions: TimelineSession[];
  timelineChartData: Array<Record<string, number>>;

  handleSelectFolder: () => void;
  handleRefresh: () => void;
  handleSelectLog: (log: LogFileInfo) => void;
  handleSelectTarget: (targetName: string | null) => void;
  handleSelectSession: (sessionId: number | null) => void;
  handleRenameLog: (log: LogFileInfo, nextName: string) => void;
  handleToggleLogFavorite: (log: LogFileInfo) => void;
}

declare global {
  interface Window {
    tlcla?: {
      app?: AppApi;
      logs?: LogsApi;
      updates?: UpdatesApi;
      export?: ExportApi;
      telemetry?: {
        getSettings: () => Promise<{
          crashReportsEnabled: boolean;
        }>;
        setSettings: (next: {
          crashReportsEnabled?: boolean;
        }) => Promise<{
          crashReportsEnabled: boolean;
        }>;
        getConfig?: () => Promise<{
          sentryDsn?: string;
        }>;
      };
      analytics?: {
        trackUsage: (
          eventName: string,
          props?: Record<string, string | number | boolean>
        ) => Promise<void>;
      };
    };
  }
}

const getLogsApi = (): LogsApi | undefined => {
  if (typeof window === "undefined") return undefined;
  return window.tlcla?.logs;
};

export const useLogsPanelLogic = (): UseLogsPanelLogicResult => {
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogFileInfo[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] = useState<LogFileInfo | null>(null);
  const [summaryState, setSummaryState] = useState<LoadState>("idle");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParsedLogSummary | null>(null);

  const [selectedTargetName, setSelectedTargetName] = useState<string | null>(
    null
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null
  );

  const [logDisplayNames, setLogDisplayNames] = useState<LogDisplayNameMap>(
    () => readLogDisplayNames()
  );
  const [logFavorites, setLogFavorites] = useState<LogFavoritesMap>(() =>
    readLogFavorites()
  );

  const isSyncingLogDisplayNamesRef = useRef(false);
  const hasInitializedLogDisplayNamesRef = useRef(false);
  const isSyncingLogFavoritesRef = useRef(false);
  const hasInitializedLogFavoritesRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChanged = () => {
      isSyncingLogDisplayNamesRef.current = true;
      setLogDisplayNames(readLogDisplayNames());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOG_DISPLAY_NAMES_STORAGE_KEY) {
        handleChanged();
      }
    };

    window.addEventListener(LOG_DISPLAY_NAMES_CHANGED_EVENT, handleChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        LOG_DISPLAY_NAMES_CHANGED_EVENT,
        handleChanged
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChanged = () => {
      isSyncingLogFavoritesRef.current = true;
      setLogFavorites(readLogFavorites());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOG_FAVORITES_STORAGE_KEY) {
        handleChanged();
      }
    };

    window.addEventListener(LOG_FAVORITES_CHANGED_EVENT, handleChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LOG_FAVORITES_CHANGED_EVENT, handleChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!hasInitializedLogDisplayNamesRef.current) {
      hasInitializedLogDisplayNamesRef.current = true;
      return;
    }

    if (isSyncingLogDisplayNamesRef.current) {
      isSyncingLogDisplayNamesRef.current = false;
      return;
    }

    writeLogDisplayNames(logDisplayNames);
  }, [logDisplayNames]);

  useEffect(() => {
    if (!hasInitializedLogFavoritesRef.current) {
      hasInitializedLogFavoritesRef.current = true;
      return;
    }

    if (isSyncingLogFavoritesRef.current) {
      isSyncingLogFavoritesRef.current = false;
      return;
    }

    writeLogFavorites(logFavorites);
  }, [logFavorites]);

  useEffect(() => {
    setLogs((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((log) => {
        const name =
          logDisplayNames[log.path] ?? getBasenameFromPath(log.path);
        if (log.name === name) return log;
        changed = true;
        return { ...log, name };
      });
      return changed ? next : prev;
    });

    setSelectedLog((prev) => {
      if (!prev) return prev;
      const name = logDisplayNames[prev.path] ?? getBasenameFromPath(prev.path);
      if (prev.name === name) return prev;
      return { ...prev, name };
    });
  }, [logDisplayNames]);

  const applyLogDisplayNames = useCallback(
    (files: LogFileInfo[]): LogFileInfo[] =>
      files.map((file) => ({
        ...file,
        name: logDisplayNames[file.path] ?? file.name,
      })),
    [logDisplayNames]
  );

  const handleRenameLog = useCallback((log: LogFileInfo, nextName: string) => {
    const originalName = getBasenameFromPath(log.path);
    const trimmed = nextName.trim();
    const nextDisplayName =
      trimmed && trimmed !== originalName ? trimmed : "";

    setLogDisplayNames((prev) => {
      const next: LogDisplayNameMap = { ...prev };
      if (nextDisplayName) next[log.path] = nextDisplayName;
      else delete next[log.path];
      return next;
    });

    setLogs((prev) =>
      prev.map((item) => {
        if (item.path !== log.path) return item;
        return {
          ...item,
          name: nextDisplayName || originalName,
        };
      })
    );

    setSelectedLog((prev) => {
      if (!prev || prev.path !== log.path) return prev;
      return {
        ...prev,
        name: nextDisplayName || originalName,
      };
    });
  }, []);

  const handleToggleLogFavorite = useCallback((log: LogFileInfo) => {
    setLogFavorites((prev) => {
      const next: LogFavoritesMap = { ...prev };
      if (next[log.path]) delete next[log.path];
      else next[log.path] = true;
      return next;
    });
  }, []);

  // Bootstrap: get default directories & first folder logs
  useEffect(() => {
    const api = getLogsApi();
    if (!api) {
      setError(
        "Logs API not available. Make sure you run the app via Electron."
      );
      setState("error");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        setState("loading");
        const dirs = await api.getDefaultDirectories();
        if (cancelled) return;

        if (dirs.length > 0) {
          const dir = dirs[0];
          setSelectedDir(dir);
          const files = await api.listFiles(dir);
          if (cancelled) return;
          setLogs(applyLogDisplayNames(files));
          setState("loaded");
        } else {
          setState("idle");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[logs] init failed", err);
        setError("Failed to read default TL folders.");
        setState("error");
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [applyLogDisplayNames]);

  const loadLogsForDirectory = useCallback(async (dir: string) => {
    const api = getLogsApi();
    if (!api) {
      setError(
        "Logs API not available. Make sure you run the app via Electron."
      );
      setState("error");
      return;
    }

    setState("loading");
    setError(null);

    try {
      const files = await api.listFiles(dir);
      setLogs(applyLogDisplayNames(files));
      setState("loaded");
    } catch (err) {
      console.error("[logs] listFiles failed", err);
      setError("Failed to list combat logs.");
      setState("error");
    }
  }, [applyLogDisplayNames]);

  const loadSummary = useCallback(async (log: LogFileInfo) => {
    const api = getLogsApi();
    if (!api) {
      setSummaryError(
        "Logs API not available. Make sure you run the app via Electron."
      );
      setSummaryState("error");
      return;
    }

    setSummaryState("loading");
    setSummaryError(null);
    setSummary(null);
    setSelectedTargetName(null);
    setSelectedSessionId(null);

    try {
      trackUsage("log.parse.started");
      const parsed = await api.parseSummary(log.path);
      setSummary(parsed);
      setSummaryState("loaded");
      trackUsage("log.parse.succeeded", {
        duration_seconds: typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : 0,
        total_events: parsed.totalEvents,
      });
    } catch (err) {
      console.error("[logs] parseSummary failed", err);
      setSummaryError("Failed to parse combat log.");
      setSummaryState("error");
      trackUsage("log.parse.failed");
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const api = getLogsApi();
    if (!api) return;
    try {
      trackUsage("logs.folder.select_opened");
      const dir = await api.selectDirectory();
      if (!dir) {
        trackUsage("logs.folder.select_canceled");
        return;
      }
      trackUsage("logs.folder.selected");
      setSelectedDir(dir);
      await loadLogsForDirectory(dir);
    } catch (err) {
      console.error("[logs] selectDirectory failed", err);
    }
  }, [loadLogsForDirectory]);

  const handleRefresh = useCallback(async () => {
    if (!selectedDir) return;
    trackUsage("logs.refresh");
    await loadLogsForDirectory(selectedDir);
  }, [selectedDir, loadLogsForDirectory]);

  const handleSelectLog = useCallback(
    async (log: LogFileInfo) => {
      setSelectedLog(log);
      trackUsage("log.opened");
      await loadSummary(log);
    },
    [loadSummary]
  );

  const handleSelectTarget = useCallback((targetName: string | null) => {
    setSelectedTargetName(targetName);
    setSelectedSessionId(null);
  }, []);

  const handleSelectSession = useCallback((sessionId: number | null) => {
    setSelectedSessionId(sessionId);
  }, []);

  const selectedSummaryTitle = selectedLog
    ? selectedLog.name
    : "No log selected";

  const hasLogs = logs.length > 0;

  const targets: TargetBreakdown[] = summary?.targets ?? [];

  const topTargets: TargetBreakdown[] = useMemo(() => {
    if (!targets.length) return [];
    return [...targets].sort((a, b) => b.totalDamage - a.totalDamage);
  }, [targets]);

  const overallTotalDamage = summary?.totalDamage ?? 0;
  const overallTotalEvents = summary?.totalEvents ?? 0;
  const overallDurationSeconds = summary?.durationSeconds ?? null;

  const perTargetSkills = summary?.perTargetSkills ?? {};
  const perTargetSessions = summary?.perTargetSessions ?? {};

  const timeline: DamageTimelineBucket[] = summary?.timeline ?? [];
  const hasTimeline = timeline.length > 0;

  const targetSessions: TargetSessionSummary[] =
    selectedTargetName && perTargetSessions
      ? perTargetSessions[selectedTargetName] ?? []
      : [];

  const timelineSessions: TimelineSession[] = useMemo(
    () =>
      targetSessions.map((s) => ({
        id: s.sessionId,
        startElapsed: s.startElapsed,
        endElapsed: s.endElapsed,
        durationSeconds: s.durationSeconds,
      })),
    [targetSessions]
  );

  const activeSession: TargetSessionSummary | null =
    selectedTargetName && selectedSessionId != null
      ? targetSessions.find((s) => s.sessionId === selectedSessionId) ?? null
      : null;

  const {
    currentTopSkills,
    currentTotalDamage,
    currentTotalEvents,
    currentDurationSeconds,
    currentDps,
    currentCritRate,
  } = useMemo(() => {
    if (!summary) {
      return {
        currentTopSkills: [] as SkillBreakdown[],
        currentTotalDamage: 0,
        currentTotalEvents: 0,
        currentDurationSeconds: null as number | null,
        currentDps: null as number | null,
        currentCritRate: null as number | null,
      };
    }

    // Overall (no target selected)
    if (!selectedTargetName) {
      return {
        currentTopSkills: summary.skills,
        currentTotalDamage: summary.totalDamage,
        currentTotalEvents: summary.totalEvents,
        currentDurationSeconds: summary.durationSeconds,
        currentDps: summary.dps,
        currentCritRate: summary.critRate,
      };
    }

    const sessionsForTarget = targetSessions;
    const targetRow = targets.find((t) => t.targetName === selectedTargetName);
    const skillsForTarget = perTargetSkills[selectedTargetName] ?? [];

    // Specific session selected
    if (activeSession) {
      const dps =
        activeSession.durationSeconds > 0
          ? activeSession.totalDamage / activeSession.durationSeconds
          : null;

      return {
        currentTopSkills: activeSession.skills,
        currentTotalDamage: activeSession.totalDamage,
        currentTotalEvents: activeSession.totalEvents,
        currentDurationSeconds: activeSession.durationSeconds,
        currentDps: dps,
        currentCritRate: activeSession.critRate,
      };
    }

    // All sessions for this target
    if (sessionsForTarget.length > 0) {
      // Combine session data for derived stats while keeping the aggregated
      // target totals as the source of truth.
      const sessionTotals = sessionsForTarget.reduce(
        (acc, session) => {
          acc.damage += session.totalDamage;
          acc.events += session.totalEvents;
          acc.duration += session.durationSeconds;
          acc.critHits += session.critHits;
          return acc;
        },
        {
          damage: 0,
          events: 0,
          duration: 0,
          critHits: 0,
        }
      );

      const totalDamage =
        targetRow?.totalDamage ?? sessionTotals.damage;
      const totalEvents =
        targetRow?.totalHits ?? sessionTotals.events;
      const totalDuration =
        sessionTotals.duration > 0
          ? sessionTotals.duration
          : summary.durationSeconds;
      const critRate =
        totalEvents > 0
          ? (sessionTotals.critHits / totalEvents) * 100
          : targetRow?.critRate ?? null;
      const dps =
        totalDuration && totalDuration > 0
          ? totalDamage / totalDuration
          : null;

      return {
        currentTopSkills: skillsForTarget,
        currentTotalDamage: totalDamage,
        currentTotalEvents: totalEvents,
        currentDurationSeconds: totalDuration,
        currentDps: dps,
        currentCritRate: critRate,
      };
    }

    const aggregateDamage = targetRow?.totalDamage ?? 0;
    const aggregateEvents = targetRow?.totalHits ?? 0;
    const aggregateDuration = summary.durationSeconds;
    const aggregateDps =
      aggregateDuration && aggregateDuration > 0
        ? aggregateDamage / aggregateDuration
        : null;

    // Fallback: single aggregated target row
    return {
      currentTopSkills: skillsForTarget,
      currentTotalDamage: aggregateDamage,
      currentTotalEvents: aggregateEvents,
      currentDurationSeconds: aggregateDuration,
      currentDps: aggregateDps,
      currentCritRate: targetRow?.critRate ?? null,
    };
  }, [
    summary,
    selectedTargetName,
    perTargetSkills,
    targetSessions,
    activeSession,
    targets,
  ]);

  // Timeline series & chart data
  const timelineSeries: TimelineSeries[] = useMemo(() => {
    if (!timeline.length) return [];

    if (selectedTargetName) {
      return [
        {
          key: "damage",
          label: selectedTargetName,
        },
      ];
    }

    const seriesTargets = topTargets.slice(0, 6);
    return seriesTargets.map((t) => ({
      key: t.targetName,
      label: t.targetName,
    }));
  }, [timeline.length, selectedTargetName, topTargets]);

  const timelineChartData: Array<Record<string, number>> = useMemo(() => {
    if (!timeline.length) return [];

    const seriesKeys = timelineSeries.map((s) => s.key);

    return timeline.map((bucket) => {
      const row: Record<string, number> = {
        t: Math.round(bucket.elapsedSeconds),
        [OVERALL_TIMELINE_KEY]: bucket.totalDamage,
      };

      if (selectedTargetName) {
        row["damage"] = bucket.perTarget[selectedTargetName] ?? 0;
      } else if (seriesKeys.length) {
        for (const key of seriesKeys) {
          row[key] = bucket.perTarget[key] ?? 0;
        }
      }

      return row;
    });
  }, [timeline, timelineSeries, selectedTargetName]);

  return {
    selectedDir,
    logs,
    logFavorites,
    state,
    error,
    hasLogs,
    selectedLog,
    summaryState,
    summaryError,
    selectedSummaryTitle,
    characterName: summary?.characterName ?? null,
    overallTotalDamage,
    overallTotalEvents,
    overallDurationSeconds,
    selectedTargetName,
    selectedSessionId,
    currentTotalDamage,
    currentTotalEvents,
    currentDps,
    currentCritRate,
    currentDurationSeconds,
    currentTopSkills,
    targets,
    topTargets,
    hasTimeline,
    timeline,
    timelineSeries,
    timelineSessions,
    timelineChartData,
    handleSelectFolder,
    handleRefresh,
    handleSelectLog,
    handleSelectTarget,
    handleSelectSession,
    handleRenameLog,
    handleToggleLogFavorite,
  };
};
