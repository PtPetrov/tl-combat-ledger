// src/components/logs/logsViewUtils.ts
import { SkillBreakdown } from "../types/logTypes";

export const TIMELINE_COLORS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#eab308",
  "#ec4899",
];

export const scrollBarStyles = {
  "&::-webkit-scrollbar": {
    height: 8,
    width: 8,
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "#020617",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(148,163,184,0.6)",
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "rgba(156,163,175,0.9)",
  },
};

export const formatShortDate = (ms: number): string => {
  if (!Number.isFinite(ms)) return "Unknown";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

export const formatDamageWithDecimals = (
  value: number | null | undefined
): string => {
  if (value == null || !Number.isFinite(value)) return "0.0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};

export type ExtendedSkillBreakdown = SkillBreakdown & {
  heavyRate?: number | null;
  heavyDamage?: number | null;
  critDamage?: number | null;
  critHits?: number | null;
  maxHit?: number | null;
  normalMinHit?: number | null;
  normalMaxHit?: number | null;
  normalAvgHit?: number | null;
  normalDamage?: number | null;
  critMinHit?: number | null;
  critMaxHit?: number | null;
  critAvgHit?: number | null;
  heavyMinHit?: number | null;
  heavyMaxHit?: number | null;
  heavyAvgHit?: number | null;
  minHit?: number | null;
};
