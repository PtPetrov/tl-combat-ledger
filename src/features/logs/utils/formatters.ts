// src/components/logs/formatters.ts

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, power);
  return `${value.toFixed(1)} ${units[power]}`;
};

export const formatDateTime = (ms: number): string => {
  if (!Number.isFinite(ms)) return "Unknown";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
};

export const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return "Unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export const formatInteger = (value: number | null | undefined): string => {
  if (!Number.isFinite(value ?? NaN)) return "0";
  return Math.round(value as number).toLocaleString();
};

export const formatNumber = (
  value: number | null | undefined,
  fractionDigits = 1
): string => {
  if (!Number.isFinite(value ?? NaN)) return "–";
  return (value as number).toFixed(fractionDigits);
};

export const formatPercent = (value: number | null | undefined): string => {
  if (!Number.isFinite(value ?? NaN)) return "–";
  return `${(value as number).toFixed(1)}%`;
};
