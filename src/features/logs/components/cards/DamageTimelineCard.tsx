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
import placeholderLogo from "../../../../../resources/logo.png?inline";
import {
  OVERALL_TIMELINE_KEY,
  TimelineSeries,
  TimelineSession,
} from "../../hooks/useLogsPanelLogic";
import {
  LoadState,
  DamageTimelineBucket,
  TimelineSkillContribution,
} from "../../types/logTypes";
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
import { formatInteger } from "../../utils/formatters";
import {
  cardGap,
  cardPaddingX,
  cardPaddingY,
} from "../ui";
import { getSkillIconPath } from "../panels/SkillsTableSection";

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

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

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
    let compressPulls = false;
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
          compressPulls = true;
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

    if (compressPulls && selectedTargetName) {
      const pulls = [...timelineSessions]
        .sort((a, b) => a.startElapsed - b.startElapsed)
        .map((s) => ({
          start: Math.floor(s.startElapsed),
          end: Math.ceil(s.endElapsed),
        }))
        .filter((s) => s.end >= s.start);

      let offset = 0;
      const segments = pulls.map((s, idx) => {
        const duration = Math.max(0, s.end - s.start);
        const seg = { ...s, offset, duration };
        offset += duration + GAP_SEC;
        if (idx < pulls.length - 1) {
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
        ? "Pull time (gaps trimmed)"
        : "Time since pull start"
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

  const burstAnalysis = useMemo((): {
    overlay: BurstWindow[];
    intensityByIdx: Map<number, number>;
  } => {
    const intensityByIdx = new Map<number, number>();
    if (!baseDpsSeries.length) return { overlay: [], intensityByIdx };

    const dps = baseDpsSeries;
    const maxGapSeconds = 1.5;

    // Burst windows are detected as local DPS spike windows (short-term smoothed DPS vs rolling
    // median baseline), with hysteresis + minimum duration, to match rotation “burst window”
    // meaning rather than global percentile spikes.
    const smoothSec = 3;
    const baselineSec = 25;
    const startRatio = 1.4;
    const endRatio = 1.2;
    const minLenSec = 4;
    const mergeGapSec = 2;
    const refractorySec = 6;
    const eps = 1;

    const toFiniteNonNegative = (v: unknown): number => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, n);
    };

    const movingAverageCentered = (arr: number[], windowSize: number): number[] => {
      const out = new Array(arr.length).fill(0);
      const half = Math.max(0, Math.floor(windowSize / 2));
      for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - half);
        const end = Math.min(arr.length - 1, i + half);
        let sum = 0;
        for (let j = start; j <= end; j++) sum += arr[j];
        out[i] = sum / Math.max(1, end - start + 1);
      }
      return out;
    };

    const median = (values: number[]): number => {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 1) return sorted[mid];
      return (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const rollingMedianCentered = (arr: number[], windowSize: number): number[] => {
      const out = new Array(arr.length).fill(0);
      const half = Math.max(0, Math.floor(windowSize / 2));
      for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - half);
        const end = Math.min(arr.length - 1, i + half);
        out[i] = median(arr.slice(start, end + 1));
      }
      return out;
    };

    type BurstCandidate = BurstWindow & {
      score: number;
      segmentId: number;
    };

    const segments: Array<{ start: number; end: number }> = [];
    let segStart = 0;
    for (let i = 1; i <= dps.length; i++) {
      const isBoundary =
        i === dps.length ||
        (Number.isFinite(dps[i]?.x) &&
          Number.isFinite(dps[i - 1]?.x) &&
          dps[i].x - dps[i - 1].x > maxGapSeconds);

      if (isBoundary) {
        segments.push({ start: segStart, end: i - 1 });
        segStart = i;
      }
    }

    const bursts: BurstCandidate[] = [];

    for (let segmentId = 0; segmentId < segments.length; segmentId++) {
      const { start, end } = segments[segmentId];
      const len = end - start + 1;
      if (len < minLenSec) continue;

      const raw = new Array(len).fill(0).map((_, i) => toFiniteNonNegative(dps[start + i].value));
      const smoothed = movingAverageCentered(raw, smoothSec);
      const baseline = rollingMedianCentered(smoothed, baselineSec);
      const ratios = smoothed.map((v, i) => v / Math.max(baseline[i], eps));
      const ratiosStable = movingAverageCentered(ratios, smoothSec);

      // Burst intensity is derived from the same local ratio (smoothed DPS vs rolling baseline).
      // Ramp from 0% at/below endRatio up to 100% at/above startRatio (stable across segments).
      const intensityRaw = new Array(len).fill(0).map((_, i) => {
        const r = ratiosStable[i];
        if (r <= endRatio) return 0;
        if (r >= startRatio) return 100;
        return ((r - endRatio) / (startRatio - endRatio)) * 100;
      });
      const intensityStable = movingAverageCentered(intensityRaw, smoothSec);
      for (let i = 0; i < len; i++) {
        const pct = Math.round(intensityStable[i]);
        intensityByIdx.set(dps[start + i].idx, clampNumber(pct, 0, 100));
      }

      let inBurst = false;
      let runStartIdx = -1;
      let lastEndIdx = -1_000_000;

      const emitBurst = (runStart: number, runEnd: number) => {
        const runLen = runEnd - runStart + 1;
        if (runLen < minLenSec) return;

        // Choose the peak at the highest observed DPS point inside the burst window, so the dot
        // visually lands on the peak of the DPS curve.
        let peakIdx = runStart;
        let peak = raw[runStart];
        let score = 0;
        for (let i = runStart; i <= runEnd; i++) {
          if (
            raw[i] > peak ||
            (raw[i] === peak && ratiosStable[i] > ratiosStable[peakIdx])
          ) {
            peakIdx = i;
            peak = raw[i];
          }
          score += Math.max(0, smoothed[i] - baseline[i]);
        }

        bursts.push({
          x1: dps[start + runStart].x,
          x2: dps[start + runEnd].x,
          peakX: dps[start + peakIdx].x,
          peak,
          score,
          segmentId,
        });
      };

      for (let i = 0; i < len; i++) {
        const ratio = ratios[i];

        if (!inBurst) {
          if (ratio >= startRatio && i - lastEndIdx > refractorySec) {
            inBurst = true;
            runStartIdx = i;
          }
          continue;
        }

        if (ratio <= endRatio) {
          emitBurst(runStartIdx, i - 1);
          inBurst = false;
          runStartIdx = -1;
          lastEndIdx = i - 1;
        }
      }

      if (inBurst && runStartIdx >= 0) {
        emitBurst(runStartIdx, len - 1);
      }
    }

    const merged = bursts
      .sort((a, b) => a.x1 - b.x1)
      .reduce<BurstCandidate[]>((acc, current) => {
        const last = acc[acc.length - 1];
        if (!last) return [current];

        if (
          current.segmentId === last.segmentId &&
          current.x1 <= last.x2 + mergeGapSec
        ) {
          last.x2 = Math.max(last.x2, current.x2);
          last.score += current.score;
          if (current.peak > last.peak) {
            last.peak = current.peak;
            last.peakX = current.peakX;
          }
          return acc;
        }

        acc.push(current);
        return acc;
      }, []);

    const overlay = merged
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.peak - a.peak))
      .slice(0, 4)
      .sort((a, b) => a.x1 - b.x1)
      .map(({ x1, x2, peakX, peak }) => ({ x1, x2, peakX, peak }));

    return { overlay, intensityByIdx };
  }, [baseDpsSeries]);

  const burstOverlay = burstAnalysis.overlay;
  const burstIntensityByIdx = burstAnalysis.intensityByIdx;

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

    const stabilityItem = payload.find(
      (p) => String(p?.dataKey) === "stability"
    );
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
    const burstIntensityPct =
      showBurst && idx >= 0 ? burstIntensityByIdx.get(idx) ?? 0 : 0;
    const burstIntensityDisplayPct = isInBurst ? 100 : burstIntensityPct;

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

    const titleTime = `Time since pull start ${formatTime(resolveRelativeTime())}`;
    const secondaryTime =
      null;

    return (
      <Box
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        sx={{
          minWidth: 380,
          maxWidth: 520,
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

        <Box
          sx={{
            display: "flex",
            gap: 1.2,
            mt: 1.2,
            flexWrap: "nowrap",
            alignItems: "stretch",
          }}
        >
          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 0,
              border: "1px solid rgba(55,65,81,0.75)",
              backgroundColor: "rgba(2,6,23,0.35)",
              minWidth: 0,
              flex: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "rgba(226,232,240,0.7)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.15,
              }}
            >
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
                minWidth: 0,
                flex: 1,
              }}
            >
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "rgba(226,232,240,0.7)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.15,
                  }}
                >
                  Rotation consistency
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
              minWidth: 0,
              flex: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "rgba(226,232,240,0.7)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.15,
              }}
            >
              Burst damage
            </Typography>
            <Typography
              sx={{
                fontSize: "0.95rem",
                fontWeight: 900,
                color:
                  isInBurst && burstIntensityDisplayPct > 0
                    ? "rgba(239,68,68,0.95)"
                    : "rgba(226,232,240,0.6)",
              }}
            >
              {burstIntensityDisplayPct}%
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
                <Typography
                  sx={{
                    fontSize: "0.9rem",
                    fontWeight: 900,
                    color: "#c7d2fe",
                    whiteSpace: "nowrap",
                    textAlign: "right",
                  }}
                >
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
            "& .recharts-responsive-container, & .recharts-wrapper, & .recharts-surface": {
              outline: "none",
              border: "none",
              boxShadow: "none",
            },
            "&:focus-within": {
              outline: "none",
            },
            "& *:focus, & *:focus-visible": {
              outline: "none",
              boxShadow: "none",
            },
            "& svg, & svg:focus, & svg:focus-visible": {
              outline: "none",
            },
            "& .recharts-responsive-container:focus, & .recharts-responsive-container:focus-visible": {
              outline: "none",
            },
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
                    title="Highlights burst moments (red areas) when your damage spikes for a short time. Burst % is an intensity meter: low = normal, 100% = you’re in a burst."
                    arrow
                    placement="top"
                  >
                    <span>Burst damage</span>
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
                    title="Adds a rotation consistency line (higher = more consistent DPS; lower = spikes/downtime)."
                    arrow
                    placement="top"
                  >
                    <span>Rotation consistency</span>
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
                  ? ` • Rotation consistency ${(stabilitySeries.avg * 100).toFixed(0)}%`
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
                cursor={isTooltipPinned ? false : undefined}
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
                    key={`peak-${b.x1}-${b.peakX}`}
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
