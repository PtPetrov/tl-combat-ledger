// src/components/logs/logTypes.ts
// Renderer-local + shared contract types for the logs feature.

export type LoadState = "idle" | "loading" | "loaded" | "error";

export type {
  DamageTimelineBucket,
  LogFileInfo,
  ParsedLogSummary,
  PerTargetSessionsMap,
  PerTargetSkillsMap,
  SkillBreakdown,
  TargetBreakdown,
  TargetSessionSummary,
  TimelineSkillContribution,
} from "../../../../shared/types";
