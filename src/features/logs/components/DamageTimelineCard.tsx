import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import {
  OVERALL_TIMELINE_KEY,
  TimelineSeries,
  TimelineSession,
} from "../hooks/useLogsPanelLogic";
import { LoadState } from "../types/logTypes";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

interface DamageTimelineCardProps {
  summaryState: LoadState;
  hasTimeline: boolean;
  timelineSeries: TimelineSeries[];
  timelineChartData: Array<Record<string, number>>;
  timelineSessions: TimelineSession[];
  selectedTargetName: string | null;
  selectedSessionId: number | null;
}

export const DamageTimelineCard: React.FC<DamageTimelineCardProps> = ({
  summaryState,
  hasTimeline,
  timelineSeries,
  timelineChartData,
  timelineSessions,
  selectedTargetName,
  selectedSessionId,
}) => {
  const showStats = summaryState === "loaded";
  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return "00:00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const chartData = useMemo(() => {
    if (!hasTimeline || !timelineChartData.length) return [];

    const filterBySession = (
      data: Array<{ t: number; value: number }>
    ): Array<{ t: number; value: number }> => {
      if (selectedSessionId == null) return data;
      const activeSession = timelineSessions.find(
        (session) => session.id === selectedSessionId
      );
      if (!activeSession) return data;
      const start = Math.floor(activeSession.startElapsed);
      const end = Math.ceil(activeSession.endElapsed);
      return data.filter((point) => point.t >= start && point.t <= end);
    };

    if (selectedTargetName) {
      const series =
        timelineSeries.find((s) => s.label === selectedTargetName) ||
        timelineSeries[0];
      if (!series) return [];

      const seriesData = timelineChartData.map((point) => ({
        t: point.t,
        value: point[series.key] ?? 0,
      }));

      return filterBySession(seriesData);
    }

    const baseData = timelineChartData.map((point) => {
      const aggregate =
        point[OVERALL_TIMELINE_KEY] ??
        timelineSeries.reduce(
          (sum, s) => sum + (point[s.key] ?? 0),
          0
        );

      return {
        t: point.t,
        value: aggregate,
      };
    });

    return filterBySession(baseData);
  }, [
    hasTimeline,
    timelineChartData,
    timelineSeries,
    selectedTargetName,
    selectedSessionId,
    timelineSessions,
  ]);

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
        <Box sx={{ mt: 0.5, flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 8, left: 0, bottom: 4 }}
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
              <XAxis
                dataKey="t"
                tickFormatter={(v) => formatTime(Number(v))}
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
              />
              <YAxis
                tickFormatter={(v) => formatInteger(v)}
                stroke="#94a3b8"
                width={80}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid rgba(148,163,184,0.6)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#1f2937",
                }}
                labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                formatter={(value: any) => [
                  formatInteger(Number(value)),
                  "Damage per second",
                ]}
                labelFormatter={(label) =>
                  `Timestamp ${formatTime(Number(label))}`
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#damageArea)"
                dot={{ r: 3, stroke: "#6366f1", fill: "#f8fafc" }}
                activeDot={{
                  r: 5,
                  stroke: "#4338ca",
                  fill: "#eef2ff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
};

DamageTimelineCard.displayName = "DamageTimelineCard";
