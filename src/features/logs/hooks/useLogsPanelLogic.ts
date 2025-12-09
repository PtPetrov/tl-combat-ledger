// src/components/logs/useLogsPanelLogic.ts
import { useCallback, useEffect, useMemo, useState } from "react";
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

type LogsApi = {
  getDefaultDirectories: () => Promise<string[]>;
  selectDirectory: () => Promise<string | null>;
  listFiles: (directory: string) => Promise<LogFileInfo[]>;
  parseSummary: (filePath: string) => Promise<ParsedLogSummary>;
};

export interface TimelineSeries {
  key: string; // data key in chart data
  label: string; // legend label
}

export const OVERALL_TIMELINE_KEY = "__overallDamage";

export interface TimelineSession {
  id: number;
  startElapsed: number;
  endElapsed: number;
  durationSeconds: number;
}

export interface UseLogsPanelLogicResult {
  defaultDirs: string[];
  selectedDir: string | null;
  logs: LogFileInfo[];
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
  handleSelectDefaultDir: (dir: string) => void;
  handleSelectTarget: (targetName: string | null) => void;
  handleSelectSession: (sessionId: number | null) => void;
}

declare global {
  interface Window {
    tlcla?: {
      logs?: LogsApi;
      updates?: UpdatesApi;
    };
  }
}

const getLogsApi = (): LogsApi | undefined => {
  if (typeof window === "undefined") return undefined;
  return window.tlcla?.logs;
};

export const useLogsPanelLogic = (): UseLogsPanelLogicResult => {
  const [defaultDirs, setDefaultDirs] = useState<string[]>([]);
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

        setDefaultDirs(dirs);

        if (dirs.length > 0) {
          const dir = dirs[0];
          setSelectedDir(dir);
          const files = await api.listFiles(dir);
          if (cancelled) return;
          setLogs(files);
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
  }, []);

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
      setLogs(files);
      setState("loaded");
    } catch (err) {
      console.error("[logs] listFiles failed", err);
      setError("Failed to list combat logs.");
      setState("error");
    }
  }, []);

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
      const parsed = await api.parseSummary(log.path);
      setSummary(parsed);
      setSummaryState("loaded");
    } catch (err) {
      console.error("[logs] parseSummary failed", err);
      setSummaryError("Failed to parse combat log.");
      setSummaryState("error");
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const api = getLogsApi();
    if (!api) return;
    try {
      const dir = await api.selectDirectory();
      if (!dir) return;
      setSelectedDir(dir);
      await loadLogsForDirectory(dir);
    } catch (err) {
      console.error("[logs] selectDirectory failed", err);
    }
  }, [loadLogsForDirectory]);

  const handleRefresh = useCallback(async () => {
    if (!selectedDir) return;
    await loadLogsForDirectory(selectedDir);
  }, [selectedDir, loadLogsForDirectory]);

  const handleSelectDefaultDir = useCallback(
    async (dir: string) => {
      setSelectedDir(dir);
      await loadLogsForDirectory(dir);
    },
    [loadLogsForDirectory]
  );

  const handleSelectLog = useCallback(
    async (log: LogFileInfo) => {
      setSelectedLog(log);
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
    defaultDirs,
    selectedDir,
    logs,
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
    handleSelectDefaultDir,
    handleSelectTarget,
    handleSelectSession,
  };
};
