export type LogFileInfo = {
  name: string;
  path: string;
  size: number;
  modifiedAt: number;
};

export type SkillBreakdown = {
  skillName: string;
  totalHits: number;
  totalDamage: number;
  maxHit: number;
  avgHit: number;
  critHits: number;
  critRate: number;
  minHit: number;
  normalMinHit?: number | null;
  normalMaxHit?: number | null;
  normalAvgHit?: number | null;
  normalDamage?: number | null;
  critDamage?: number | null;
  critMinHit?: number | null;
  critMaxHit?: number | null;
  critAvgHit?: number | null;
  heavyHits?: number | null;
  heavyDamage?: number | null;
  heavyRate?: number | null;
  heavyMinHit?: number | null;
  heavyMaxHit?: number | null;
  heavyAvgHit?: number | null;
};

export type TargetBreakdown = {
  targetName: string;
  totalHits: number;
  totalDamage: number;
  maxHit: number;
  avgHit: number;
  critHits: number;
  critRate: number;
};

export type TimelineSkillContribution = {
  skillName: string;
  damage: number;
  hits: number;
  critHits: number;
  heavyHits: number;
};

export type DamageTimelineBucket = {
  timestampMs: number;
  elapsedSeconds: number; // seconds from first event
  totalDamage: number;
  perTarget: Record<string, number>;
  skills?: Record<string, TimelineSkillContribution[]>;
};

export type PerTargetSkillsMap = Record<string, SkillBreakdown[]>;

export type TargetSessionSummary = {
  sessionId: number;
  startElapsed: number; // seconds from first event
  endElapsed: number;
  durationSeconds: number;
  totalDamage: number;
  totalEvents: number;
  critHits: number;
  critRate: number;
  skills: SkillBreakdown[];
};

export type PerTargetSessionsMap = Record<string, TargetSessionSummary[]>;

export type ParsedLogSummary = {
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
  perTargetSessions?: PerTargetSessionsMap;
  timeline: DamageTimelineBucket[];
};

export type UpdateStatusState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export type UpdateStatusPayload = {
  state: UpdateStatusState;
  version?: string;
  percent?: number;
  message?: string;
};

export type ExportResult = {
  canceled: boolean;
  filePath?: string;
  error?: string;
};

export type TelemetrySettings = {
  crashReportsEnabled: boolean;
};

export type TelemetryPublicConfig = {
  sentryDsn?: string;
};

export type AnalyticsProps = Record<string, string | number | boolean>;
