import React, { useMemo, useState } from "react";
import {
  Box,
  FormControlLabel,
  IconButton,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import placeholderLogo from "../../../../resources/logo.png?inline";
import {
  OVERALL_TIMELINE_KEY,
  TimelineSeries,
  TimelineSession,
} from "../hooks/useLogsPanelLogic";
import {
  LoadState,
  DamageTimelineBucket,
  TimelineSkillContribution,
} from "../types/logTypes";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatInteger } from "../utils/formatters";
import {
  cardGap,
  cardPaddingX,
  cardPaddingY,
} from "./layoutTokens";
import { getSkillIconPath } from "./SkillsTableSection";

interface DamageTimelineCardProps {
  summaryState: LoadState;
  hasTimeline: boolean;
  timeline: DamageTimelineBucket[];
  timelineSeries: TimelineSeries[];
  timelineChartData: Array<Record<string, number>>;
  timelineSessions: TimelineSession[];
  selectedTargetName: string | null;
  selectedSessionId: number | null;
}

type TimelineViewMode = "dps" | "cumulative";
type XAxisMode = "absolute" | "relative";

type StabilitySeries = {
  points: Array<{ x: number; idx: number; stability: number }>;
  avg: number;
};
type StabilityDisplayPoint = { x: number; stability: number | null };
type BurstWindow = { x1: number; x2: number; peakX: number; peak: number };
type TooltipPoint = { x: number; value: number | null; idx: number; tAbs: number };

export const DamageTimelineCard: React.FC<DamageTimelineCardProps> = ({
  summaryState,
  hasTimeline,
  timeline,
  timelineSeries,
  timelineChartData,
  timelineSessions,
  selectedTargetName,
  selectedSessionId,
}) => {
  const [viewMode, setViewMode] = useState<TimelineViewMode>("dps");
  const [showBurst, setShowBurst] = useState(true);
  const [showStability, setShowStability] = useState(true);
  const [isTooltipPinned, setIsTooltipPinned] = useState(false);
  const [suppressHoverTooltip, setSuppressHoverTooltip] = useState(false);

  const showStats = summaryState === "loaded";

  const xAxisMode: XAxisMode = selectedTargetName ? "relative" : "absolute";
  const isAllSessionsForTarget =
    Boolean(selectedTargetName) &&
    selectedSessionId == null &&
    timelineSessions.length > 1;

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return "00:00";
    const abs = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(abs / 3600);
    const mins = Math.floor((abs % 3600) / 60);
    const secs = Math.floor(abs % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const computeTickStep = (rangeSeconds: number): number => {
    const candidates = [
      1, 2, 5, 10, 15, 30,
      60, 120, 300, 600, 900,
      1800, 3600, 7200,
    ];
    const targetTicks = 8;
    for (const step of candidates) {
      if (rangeSeconds / step <= targetTicks) return step;
    }
    return 14400;
  };

  const makeTicks = (
    data: Array<{ x: number }>,
    range: { startIndex: number; endIndex: number } | null
  ): number[] => {
    if (!data.length) return [];
    const startIndex = range?.startIndex ?? 0;
    const endIndex = range?.endIndex ?? data.length - 1;
    const start = Math.max(0, Math.min(startIndex, data.length - 1));
    const end = Math.max(start, Math.min(endIndex, data.length - 1));
    const xMin = data[start]?.x ?? 0;
    const xMax = data[end]?.x ?? xMin;
    const span = Math.max(0, xMax - xMin);
    const step = computeTickStep(span);
    if (span === 0) return [xMin];

    const ticks: number[] = [];
    ticks.push(xMin);
    const first = Math.ceil(xMin / step) * step;
    for (let t = first; t < xMax; t += step) {
      if (t > xMin && t < xMax) ticks.push(t);
    }
    ticks.push(xMax);
    return Array.from(new Set(ticks)).sort((a, b) => a - b);
  };

  const { series: baseDpsSeries, sessionBreakXs } = useMemo<{
    series: Array<{ x: number; value: number; idx: number; tAbs: number }>;
    sessionBreakXs: number[];
  }>(() => {
    if (!hasTimeline || !timelineChartData.length) {
      return { series: [], sessionBreakXs: [] };
    }

    let windowStart: number | null = null;
    let windowEnd: number | null = null;
    let compressSessions = false;
    const GAP_SEC = 4;
    const breaks: number[] = [];

    if (selectedTargetName && timelineSessions.length > 0) {
      if (selectedSessionId != null) {
        const activeSession = timelineSessions.find((s) => s.id === selectedSessionId);
        if (activeSession) {
          windowStart = Math.floor(activeSession.startElapsed);
          windowEnd = Math.ceil(activeSession.endElapsed);
        }
      } else {
        if (timelineSessions.length === 1) {
          const only = timelineSessions[0];
          windowStart = Math.floor(only.startElapsed);
          windowEnd = Math.ceil(only.endElapsed);
        } else {
          compressSessions = true;
        }
      }
    }

    const seriesValueForPoint = (point: Record<string, number>): number => {
      if (selectedTargetName) {
        const series =
          timelineSeries.find((s) => s.label === selectedTargetName) || timelineSeries[0];
        if (!series) return 0;
        return point[series.key] ?? 0;
      }

      return (
        point[OVERALL_TIMELINE_KEY] ??
        timelineSeries.reduce((sum, s) => sum + (point[s.key] ?? 0), 0)
      );
    };

    const base = timelineChartData.map((point, idx) => ({
      idx,
      tAbs: Number(point.t),
      dps: seriesValueForPoint(point),
    }));

    if (compressSessions && selectedTargetName) {
      const sessions = [...timelineSessions]
        .sort((a, b) => a.startElapsed - b.startElapsed)
        .map((s) => ({
          start: Math.floor(s.startElapsed),
          end: Math.ceil(s.endElapsed),
        }))
        .filter((s) => s.end >= s.start);

      let offset = 0;
      const segments = sessions.map((s, idx) => {
        const duration = Math.max(0, s.end - s.start);
        const seg = { ...s, offset, duration };
        offset += duration + GAP_SEC;
        if (idx < sessions.length - 1) {
          breaks.push(seg.offset + seg.duration + GAP_SEC / 2);
        }
        return seg;
      });

      const series: Array<{ x: number; value: number; idx: number; tAbs: number }> = [];
      let segIndex = 0;
      for (const p of base) {
        while (segIndex < segments.length && p.tAbs > segments[segIndex].end) {
          segIndex += 1;
        }
        if (segIndex >= segments.length) break;
        const seg = segments[segIndex];
        if (p.tAbs < seg.start) continue;
        series.push({
          x: p.tAbs - seg.start + seg.offset,
          value: p.dps,
          idx: p.idx,
          tAbs: p.tAbs,
        });
      }

      return { series, sessionBreakXs: breaks };
    }

    const filtered =
      windowStart != null && windowEnd != null
        ? base.filter((p) => p.tAbs >= windowStart! && p.tAbs <= windowEnd!)
        : base;

    const xZero =
      xAxisMode === "relative"
        ? windowStart ?? (filtered[0]?.tAbs ?? 0)
        : 0;

    const series: Array<{ x: number; value: number; idx: number; tAbs: number }> =
      filtered.map((p) => ({
      x: xAxisMode === "relative" ? p.tAbs - xZero : p.tAbs,
      value: p.dps,
      idx: p.idx,
      tAbs: p.tAbs,
    }));

    return { series, sessionBreakXs: [] };
  }, [
    hasTimeline,
    timelineChartData,
    timelineSeries,
    selectedTargetName,
    selectedSessionId,
    timelineSessions,
    xAxisMode,
  ]);

  const chartData = useMemo((): TooltipPoint[] => {
    if (!baseDpsSeries.length) return [];

    const insertSessionBreaks = (points: TooltipPoint[]): TooltipPoint[] => {
      if (!isAllSessionsForTarget || !sessionBreakXs.length) return points;
      const out: TooltipPoint[] = [];
      let breakIndex = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        out.push(p);
        while (
          breakIndex < sessionBreakXs.length &&
          sessionBreakXs[breakIndex] > p.x &&
          (i === points.length - 1 ||
            sessionBreakXs[breakIndex] < points[i + 1].x)
        ) {
          out.push({
            x: sessionBreakXs[breakIndex],
            value: null,
            idx: -1,
            tAbs: Number.NaN,
          });
          breakIndex += 1;
        }
      }
      return out;
    };

    const dpsForDisplay =
      baseDpsSeries;

    if (viewMode === "cumulative") {
      let acc = 0;
      const cumulative = dpsForDisplay.map((p) => {
        acc += p.value;
        return { x: p.x, value: acc, idx: p.idx, tAbs: p.tAbs };
      });
      return insertSessionBreaks(cumulative);
    }

    const dps: TooltipPoint[] = dpsForDisplay.map((p) => ({
      x: p.x,
      value: p.value,
      idx: p.idx,
      tAbs: p.tAbs,
    }));
    return insertSessionBreaks(dps);
  }, [baseDpsSeries, isAllSessionsForTarget, sessionBreakXs, viewMode]);

  const xTicks = useMemo(() => makeTicks(chartData, null), [chartData]);

  const yLabel =
    viewMode === "cumulative" ? "Cumulative damage" : "Damage per second";

  const xLabel =
    xAxisMode === "relative"
      ? isAllSessionsForTarget
        ? "Session time (gaps trimmed)"
        : "Time since session start"
      : "Timestamp";

  const switchSx = {
    "& .MuiSwitch-switchBase": {
      color: "rgba(148,163,184,0.75)",
    },
    "& .MuiSwitch-track": {
      backgroundColor: "rgba(148,163,184,0.35)",
      opacity: 1,
    },
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "#a5b4fc",
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
      backgroundColor: "#6366f1",
      opacity: 0.55,
    },
  } as const;

  const stabilitySeries = useMemo<StabilitySeries | null>(() => {
    // Rotation stability is derived from the underlying DPS series, not cumulative.
    if (!baseDpsSeries.length) return null;

    const dps = baseDpsSeries;

    const windowSize = 12; // ~12s rolling stability
    const half = Math.floor(windowSize / 2);

    const points: Array<{ x: number; idx: number; stability: number }> = [];

    let segStart = 0;
    for (let i = 1; i <= dps.length; i++) {
      const isBoundary =
        i === dps.length ||
        (Number.isFinite(dps[i]?.x) &&
          Number.isFinite(dps[i - 1]?.x) &&
          dps[i].x - dps[i - 1].x > 1.5);

      if (!isBoundary) continue;

      const segEnd = i - 1;
      for (let index = segStart; index <= segEnd; index++) {
        const start = Math.max(segStart, index - half);
        const end = Math.min(segEnd, index + half);
        let sum = 0;
        let count = 0;
        for (let j = start; j <= end; j++) {
          sum += dps[j].value;
          count += 1;
        }
        const mean = count > 0 ? sum / count : 0;
        let varSum = 0;
        for (let j = start; j <= end; j++) {
          const delta = dps[j].value - mean;
          varSum += delta * delta;
        }
        const std = count > 1 ? Math.sqrt(varSum / (count - 1)) : 0;
        const cv = mean > 0 ? std / mean : 0;

        // 1 / (1 + CV) maps: CV=0 => 1.0 (very stable), CV=1 => 0.5, CV=3 => 0.25
        const stability = 1 / (1 + Math.max(0, cv));
        points.push({
          x: dps[index].x,
          idx: dps[index].idx,
          stability,
        });
      }

      segStart = i;
    }

    const avg =
      points.reduce((acc, p) => acc + (Number.isFinite(p.stability) ? p.stability : 0), 0) /
      Math.max(1, points.length);

    return { points, avg };
  }, [baseDpsSeries]);

  const stabilityDisplayData = useMemo<StabilityDisplayPoint[]>(() => {
    if (!stabilitySeries) return [];
    const points = stabilitySeries.points;
    if (!isAllSessionsForTarget || !sessionBreakXs.length) {
      return points.map((p) => ({ x: p.x, stability: p.stability }));
    }

    const out: StabilityDisplayPoint[] = [];
    let breakIndex = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      out.push({ x: p.x, stability: p.stability });
      while (
        breakIndex < sessionBreakXs.length &&
        sessionBreakXs[breakIndex] > p.x &&
        (i === points.length - 1 || sessionBreakXs[breakIndex] < points[i + 1].x)
      ) {
        out.push({ x: sessionBreakXs[breakIndex], stability: null });
        breakIndex += 1;
      }
    }
    return out;
  }, [isAllSessionsForTarget, sessionBreakXs, stabilitySeries]);

  const burstOverlay = useMemo<BurstWindow[]>(() => {
    if (!baseDpsSeries.length) return [];

    const dps = baseDpsSeries;
    const maxGapSeconds = 1.5;

    const percentile = (arr: number[], p: number): number => {
      if (!arr.length) return 0;
      const idx = Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)));
      return arr[idx];
    };

    const buildBursts = (threshold: number): BurstWindow[] => {
      const minRunPoints = 3; // ~3s minimum
      const bursts: BurstWindow[] = [];

      let runStart = -1;
      let runPeak = -1;
      let runPeakX = 0;
      for (let i = 0; i < dps.length; i++) {
        const isGap =
          i > 0 &&
          Number.isFinite(dps[i].x) &&
          Number.isFinite(dps[i - 1].x) &&
          dps[i].x - dps[i - 1].x > maxGapSeconds;

        if (isGap && runStart >= 0) {
          const endIndex = i - 1;
          const len = endIndex - runStart + 1;
          if (len >= minRunPoints) {
            bursts.push({
              x1: dps[runStart].x,
              x2: dps[endIndex].x,
              peakX: runPeakX,
              peak: runPeak,
            });
          }
          runStart = -1;
          runPeak = -1;
          runPeakX = 0;
        }

        const v = dps[i].value;
        const isBurst = Number.isFinite(v) && v >= threshold;

        if (isBurst) {
          if (runStart < 0) {
            runStart = i;
            runPeak = v;
            runPeakX = dps[i].x;
          } else if (v > runPeak) {
            runPeak = v;
            runPeakX = dps[i].x;
          }
        }

        const isRunEnd = runStart >= 0 && (!isBurst || i === dps.length - 1);
        if (isRunEnd) {
          const endIndex = isBurst && i === dps.length - 1 ? i : i - 1;
          const len = endIndex - runStart + 1;
          if (len >= minRunPoints) {
            bursts.push({
              x1: dps[runStart].x,
              x2: dps[endIndex].x,
              peakX: runPeakX,
              peak: runPeak,
            });
          }
          runStart = -1;
          runPeak = -1;
          runPeakX = 0;
        }
      }

      return bursts;
    };

    const values = dps
      .map((p) => p.value)
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    if (!values.length) return [];

    let maxIndex = 0;
    let maxValue = -1;
    for (let i = 0; i < dps.length; i++) {
      if (dps[i].value > maxValue) {
        maxValue = dps[i].value;
        maxIndex = i;
      }
    }
    if (maxValue <= 0) return [];
    const maxX = dps[maxIndex].x;

    // Try progressively lower thresholds until we find at least one burst window.
    const thresholds = [
      percentile(values, 0.9),
      percentile(values, 0.85),
      percentile(values, 0.8),
      percentile(values, 0.75),
    ].filter((v, idx, arr) => idx === 0 || v < arr[idx - 1]);

    let bursts: BurstWindow[] = [];
    for (const t of thresholds) {
      bursts = buildBursts(t);
      if (bursts.length) break;
    }

    const buildPeakWindow = (peakIdx: number): BurstWindow => {
      const peakVal = dps[peakIdx].value;
      const peakX = dps[peakIdx].x;

      const ratios = [0.95, 0.9, 0.85, 0.8, 0.75, 0.7];
      for (const r of ratios) {
        const threshold = peakVal * r;
        let start = peakIdx;
        let end = peakIdx;

        while (
          start > 0 &&
          dps[start].x - dps[start - 1].x <= maxGapSeconds &&
          dps[start - 1].value >= threshold
        ) {
          start -= 1;
        }
        while (
          end < dps.length - 1 &&
          dps[end + 1].x - dps[end].x <= maxGapSeconds &&
          dps[end + 1].value >= threshold
        ) {
          end += 1;
        }

        if (end - start + 1 >= 3) {
          return {
            x1: dps[start].x,
            x2: dps[end].x,
            peakX,
            peak: peakVal,
          };
        }
      }

      let start = peakIdx;
      let end = peakIdx;
      while (
        start > 0 &&
        peakIdx - start < 2 &&
        dps[start].x - dps[start - 1].x <= maxGapSeconds
      ) {
        start -= 1;
      }
      while (
        end < dps.length - 1 &&
        end - peakIdx < 2 &&
        dps[end + 1].x - dps[end].x <= maxGapSeconds
      ) {
        end += 1;
      }

      return {
        x1: dps[start].x,
        x2: dps[end].x,
        peakX,
        peak: peakVal,
      };
    };

    const containsGlobalPeak = bursts.some((b) => maxX >= b.x1 && maxX <= b.x2);
    if (!containsGlobalPeak) {
      bursts.push(buildPeakWindow(maxIndex));
    }

    const merged = bursts
      .sort((a, b) => a.x1 - b.x1)
      .reduce<BurstWindow[]>((acc, current) => {
        const last = acc[acc.length - 1];
        if (!last) return [current];

        if (current.x1 <= last.x2 + 0.5) {
          const peakInfo =
            current.peak > last.peak
              ? { peakX: current.peakX, peak: current.peak }
              : { peakX: last.peakX, peak: last.peak };

          last.x2 = Math.max(last.x2, current.x2);
          last.peakX = peakInfo.peakX;
          last.peak = peakInfo.peak;
          return acc;
        }

        acc.push(current);
        return acc;
      }, []);

    return merged
      .sort((a, b) => b.peak - a.peak)
      .slice(0, 4)
      .sort((a, b) => a.x1 - b.x1);
  }, [baseDpsSeries]);

  const buildSkillRows = (
    skills: TimelineSkillContribution[] | undefined
  ): Array<{
    skillName: string;
    iconSrc: string;
    damage: number;
  }> => {
    if (!skills?.length) return [];
    return skills.map((s) => ({
      skillName: s.skillName,
      iconSrc: getSkillIconPath(s.skillName) ?? placeholderLogo,
      damage: s.damage,
    }));
  };

  const ThemedTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: any[];
  }) => {
    if (!active || !payload?.length) return null;
    const point: TooltipPoint | undefined = payload?.[0]?.payload;
    const idx = point?.idx ?? -1;
    if (idx < 0 || idx >= timeline.length) return null;
    const bucket = timeline[idx];

    const rawDamage =
      selectedTargetName != null
        ? bucket.perTarget[selectedTargetName] ?? 0
        : bucket.totalDamage;

    const skillsForTarget =
      selectedTargetName != null ? bucket.skills?.[selectedTargetName] : undefined;
    const skillRows = buildSkillRows(skillsForTarget);

    const stabilityItem = payload.find((p) => String(p?.name) === "stability");
    const fallbackStability =
      showStability && stabilitySeries
        ? stabilitySeries.points.find((p) => p.idx === idx)?.stability ?? null
        : null;
    const stabilityPct =
      stabilityItem?.value != null && Number.isFinite(Number(stabilityItem.value))
        ? Math.round(Number(stabilityItem.value) * 100)
        : fallbackStability != null && Number.isFinite(fallbackStability)
          ? Math.round(fallbackStability * 100)
          : null;

    const isInBurst =
      showBurst &&
      Number.isFinite(point?.x) &&
      burstOverlay.some((b) => point!.x >= b.x1 && point!.x <= b.x2);

    const resolveRelativeTime = (): number => {
      if (selectedTargetName && timelineSessions.length) {
        const matching =
          selectedSessionId != null
            ? timelineSessions.find((s) => s.id === selectedSessionId)
            : timelineSessions.find(
                (s) =>
                  Number(point?.tAbs) >= s.startElapsed - 0.5 &&
                  Number(point?.tAbs) <= s.endElapsed + 0.5
              );
        if (matching && Number.isFinite(point?.tAbs)) {
          return Math.max(0, Number(point!.tAbs) - matching.startElapsed);
        }
      }
      return Number.isFinite(point?.x) ? Number(point!.x) : 0;
    };

    const titleTime = `Time since session start ${formatTime(resolveRelativeTime())}`;
    const secondaryTime =
      null;

    return (
      <Box
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        sx={{
          minWidth: 320,
          maxWidth: 420,
          px: 1.4,
          py: 1.2,
          borderRadius: 0,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(5,8,20,0.98))",
          boxShadow: "0 18px 32px rgba(2,6,23,0.65)",
          color: "#e5e7eb",
          zIndex: 3000,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, flex: 1 }}>
            {titleTime}
          </Typography>
          {isTooltipPinned && (
            <IconButton
              size="small"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsTooltipPinned(false);
                setSuppressHoverTooltip(true);
              }}
              sx={{
                color: "rgba(226,232,240,0.7)",
                borderRadius: 0,
                p: 0.35,
                outline: "none",
                boxShadow: "none",
                "&:hover": {
                  color: "#e0e7ff",
                  backgroundColor: "rgba(2,6,23,0.35)",
                },
                "&:focus": {
                  outline: "none",
                },
                "&:focus-visible": {
                  outline: "none",
                },
              }}
              aria-label="Close tooltip"
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1.8, mt: 1.2, flexWrap: "wrap" }}>
          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 0,
              border: "1px solid rgba(55,65,81,0.75)",
              backgroundColor: "rgba(2,6,23,0.35)",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.7)" }}>
              Damage (this second)
            </Typography>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800 }}>
              {formatInteger(rawDamage)}
            </Typography>
          </Box>

          {stabilityPct != null && (
            <Box
              sx={{
                px: 1,
                py: 0.75,
                borderRadius: 0,
                border: "1px solid rgba(34,197,94,0.35)",
                backgroundColor: "rgba(2,6,23,0.35)",
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.7)" }}>
                Stability
              </Typography>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "rgba(34,197,94,0.95)" }}>
                {stabilityPct}%
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 0,
              border: "1px solid rgba(239,68,68,0.35)",
              backgroundColor: "rgba(2,6,23,0.35)",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.7)" }}>
              Burst
            </Typography>
            <Typography
              sx={{
                fontSize: "0.95rem",
                fontWeight: 900,
                color: isInBurst ? "rgba(239,68,68,0.95)" : "rgba(226,232,240,0.6)",
              }}
            >
              {isInBurst ? "Active" : "No"}
            </Typography>
          </Box>
        </Box>

        {selectedTargetName && (
          <Typography sx={{ mt: 0.9, fontSize: "0.78rem", color: "rgba(226,232,240,0.65)" }}>
            Skills (this second)
          </Typography>
        )}

        {selectedTargetName && skillRows.length > 0 ? (
          <Box
            sx={{
              mt: 0.9,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "200px",
              overflowY: "auto",
              pr: 0.5,
            }}
          >
            {skillRows.map((s) => (
              <Box
                key={s.skillName}
                sx={{
                  minHeight: 44,
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  gap: 0.8,
                  alignItems: "center",
                  px: 0.8,
                  py: 0.6,
                  borderRadius: 0,
                  border: "1px solid rgba(55,65,81,0.6)",
                  backgroundColor: "rgba(15,23,42,0.55)",
                }}
              >
                <Box
                  component="img"
                  src={s.iconSrc}
                  alt={s.skillName}
                  sx={{ width: 28, height: 28, borderRadius: 0, objectFit: "cover" }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.skillName}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: "#c7d2fe" }}>
                  {formatInteger(s.damage)}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : selectedTargetName ? (
          <Typography sx={{ mt: 0.5, fontSize: "0.85rem", color: "rgba(226,232,240,0.7)" }}>
            No skill details for this second.
          </Typography>
        ) : (
          <Typography sx={{ mt: 0.9, fontSize: "0.85rem", color: "rgba(226,232,240,0.7)" }}>
            Select a target to see per-skill breakdowns on hover.
          </Typography>
        )}
      </Box>
    );
  };

    return (
    <Box
      sx={{
        borderRadius: "2px",
        px: cardPaddingX,
        py: cardPaddingY,
        background:
          "linear-gradient(135deg, rgba(248,250,252,0.06), rgba(15,23,42,0.95))",
        boxShadow:
          "0 18px 32px rgba(2,6,23,0.55), 0 0 0 1px rgba(15,23,42,0.75)",
        display: "flex",
        flexDirection: "column",
        gap: cardGap,
        height: "100%",
        minHeight: 260,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.9rem",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "rgba(226,232,240,0.65)",
        }}
      >
        Damage Over Time
      </Typography>

      {!showStats || !chartData.length ? (
        <Typography color="text.secondary" sx={{ fontSize: "1.1rem" }}>
          Timeline unavailable for this selection.
        </Typography>
      ) : (
        <Box
          sx={{
            mt: 0.5,
            mb: 0.5,
            flex: 1,
            minHeight: 0,
            "& .recharts-wrapper:focus, & .recharts-wrapper:focus-visible": {
              outline: "none",
            },
            "& .recharts-surface:focus, & .recharts-surface:focus-visible": {
              outline: "none",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              flexWrap: "wrap",
              mb: 0.6,
            }}
          >
            <Tabs
              value={viewMode}
              onChange={(_e, value) => setViewMode(value)}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{
                minHeight: 32,
                "& .MuiTabs-indicator": {
                  backgroundColor: "#6366f1",
                },
                "& .MuiTab-root": {
                  minHeight: 32,
                  textTransform: "none",
                  fontSize: "0.9rem",
                  color: "rgba(226,232,240,0.75)",
                  px: 1.2,
                },
                "& .Mui-selected": {
                  color: "#e0e7ff",
                },
              }}
            >
              <Tab
                value="dps"
                label={
                  <Tooltip
                    title="Instant damage per second over time."
                    arrow
                    placement="top"
                  >
                    <span>DPS</span>
                  </Tooltip>
                }
              />
              <Tab
                value="cumulative"
                label={
                  <Tooltip
                    title="Total damage accumulated over time. A steadier upward slope means higher sustained DPS."
                    arrow
                    placement="top"
                  >
                    <span>Cumulative</span>
                  </Tooltip>
                }
              />
            </Tabs>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showBurst}
                  onChange={(_e, checked) => setShowBurst(checked)}
                  sx={switchSx}
                />
              }
              label={
                <Tooltip
                  title="Highlights high-DPS windows (bursts) compared to the rest of the session."
                  arrow
                  placement="top"
                >
                  <span>Burst</span>
                </Tooltip>
              }
              sx={{
                ml: 0.5,
                "& .MuiFormControlLabel-label": {
                  fontSize: "0.9rem",
                  color: "rgba(226,232,240,0.75)",
                },
              }}
            />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showStability}
                  onChange={(_e, checked) => setShowStability(checked)}
                  sx={switchSx}
                />
              }
              label={
                <Tooltip
                  title="Shows a stability line (higher = steadier output). Useful for spotting rotation consistency vs spikes/downtime."
                  arrow
                  placement="top"
                >
                  <span>Stability</span>
                </Tooltip>
              }
              sx={{
                ml: 0.5,
                "& .MuiFormControlLabel-label": {
                  fontSize: "0.9rem",
                  color: "rgba(226,232,240,0.75)",
                },
              }}
            />

            <Typography
              sx={{
                fontSize: "0.85rem",
                color: "rgba(226,232,240,0.55)",
                ml: "auto",
              }}
            >
              {xLabel} • {yLabel}
              {showStability && stabilitySeries
                ? ` • Stability ${(stabilitySeries.avg * 100).toFixed(0)}%`
                : ""}
            </Typography>
          </Box>

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              accessibilityLayer={false}
              data={chartData}
              margin={{ top: 10, right: 8, left: 0, bottom: 16 }}
              onMouseMove={() => {
                if (suppressHoverTooltip) setSuppressHoverTooltip(false);
              }}
              onClick={(state) => {
                const rawIndex = (state as any)?.activeTooltipIndex;
                const numericIndex =
                  typeof rawIndex === "number" ? rawIndex : Number(rawIndex);
                const point = Number.isFinite(numericIndex)
                  ? chartData[numericIndex]
                  : undefined;
                if (point?.idx != null && point.idx >= 0 && point.value != null) {
                  setIsTooltipPinned(true);
                  setSuppressHoverTooltip(false);
                }
              }}
            >
              <defs>
                <linearGradient id="damageArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="rgba(148,163,184,0.35)"
                vertical
                horizontal
              />
              {showBurst &&
                burstOverlay.map((b) => (
                  <ReferenceArea
                    key={`${b.x1}-${b.x2}`}
                    x1={b.x1}
                    x2={b.x2}
                    yAxisId="left"
                    fill="rgba(239,68,68,0.18)"
                    stroke="rgba(252,165,165,0.6)"
                    strokeOpacity={0.6}
                  />
                ))}
              <XAxis
                dataKey="x"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={xTicks}
                interval={0}
                tickFormatter={(v) => formatTime(Number(v))}
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => formatInteger(v)}
                stroke="#94a3b8"
                width={80}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
              />
              {showStability && stabilitySeries?.points.length ? (
                <YAxis
                  yAxisId="stability"
                  orientation="right"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  width={56}
                  tick={{ fontSize: 11, fill: "rgba(148,163,184,0.75)" }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
                />
              ) : null}
              <RechartsTooltip
                content={<ThemedTooltip />}
                trigger={isTooltipPinned ? "click" : "hover"}
                active={
                  isTooltipPinned
                    ? true
                    : suppressHoverTooltip
                      ? false
                      : undefined
                }
                wrapperStyle={{ zIndex: 4000, pointerEvents: "auto" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                yAxisId="left"
                connectNulls={false}
                name="value"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#damageArea)"
                dot={{ r: 2, stroke: "#6366f1", fill: "#f8fafc" }}
                activeDot={{
                  r: 5,
                  stroke: "#4338ca",
                  fill: "#eef2ff",
                  strokeWidth: 2,
                }}
              />
              {showBurst &&
                viewMode === "dps" &&
                burstOverlay.map((b) => (
                  <ReferenceDot
                    key={`peak-${b.peakX}`}
                    x={b.peakX}
                    y={b.peak}
                    yAxisId="left"
                    r={4}
                    fill="#f8fafc"
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                ))}
              {showStability && stabilitySeries?.points.length ? (
                <Line
                  type="monotone"
                  dataKey="stability"
                  yAxisId="stability"
                  data={stabilityDisplayData}
                  name="stability"
                  stroke="rgba(34,197,94,0.9)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
};

DamageTimelineCard.displayName = "DamageTimelineCard";
