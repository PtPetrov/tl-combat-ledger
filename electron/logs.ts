// electron/main/logs.ts
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Papa from "papaparse";

import type {
  DamageTimelineBucket,
  LogFileInfo,
  ParsedLogSummary,
  PerTargetSessionsMap,
  PerTargetSkillsMap,
  SkillBreakdown,
  TargetBreakdown,
  TimelineSkillContribution,
  TargetSessionSummary,
} from "../shared/types";

type RawRow = {
  Timestamp?: string;
  LogType?: string;
  SkillName?: string;
  SkillId?: string;
  Damage?: string;
  HitCritical?: string;
  HitDouble?: string;
  HitType?: string;
  CasterName?: string;
  TargetName?: string;
};

type SkillAccumulator = {
  skillName: string;
  totalHits: number;
  totalDamage: number;
  maxHit: number;
  sumHit: number;
  critHits: number;
  heavyHits: number;
  heavyDamage: number;
  minHit: number;
  normalMin: number;
  normalMax: number;
  normalDamage: number;
  normalHits: number;
  critDamage: number;
  critMin: number;
  critMax: number;
  heavyMin: number;
  heavyMax: number;
};

type TargetAccumulator = {
  targetName: string;
  totalHits: number;
  totalDamage: number;
  maxHit: number;
  sumHit: number;
  critHits: number;
};

type BucketAccumulator = {
  totalDamage: number;
  perTarget: Map<string, number>;
  perTargetSkills: Map<string, Map<string, TimelineSkillAccumulator>>;
};

type TimelineSkillAccumulator = {
  skillName: string;
  damage: number;
  hits: number;
  critHits: number;
  heavyHits: number;
};

type SessionAccumulator = {
  id: number;
  startMs: number;
  endMs: number;
  totalDamage: number;
  totalEvents: number;
  totalCritHits: number;
  skills: Map<string, SkillAccumulator>;
};

type TargetSessionsState = {
  sessions: SessionAccumulator[];
  current?: SessionAccumulator;
  lastEventMs?: number;
};

const HEAVY_KEYWORDS = new Set(["heavy", "heavyattack", "heavy_attack"]);

function isHeavyAttack(
  hitTypeRaw: string | undefined,
  hitDoubleRaw: string | undefined
): boolean {
  if (hitDoubleRaw === "1") {
    return true;
  }

  if (!hitTypeRaw) return false;
  const normalized = hitTypeRaw.trim().toLowerCase();
  if (!normalized) return false;

  const tokens = normalized
    .split(/[\s|,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.some((token) => HEAVY_KEYWORDS.has(token))) {
    return true;
  }

  if (normalized.includes("heavy")) {
    return true;
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    // HitType can be emitted as a bitmask.
    // Heavy Attack uses the 0b100 (4) flag in the log files.
    const HEAVY_BIT = 1 << 2;
    return (numeric & HEAVY_BIT) === HEAVY_BIT;
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseTlTimestamp(ts: string | undefined): number | null {
  if (!ts) return null;

  // Typical TL format: 20251204-18:29:39:714
  const m =
    ts && ts.match(/^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2}):(\d{3})$/);
  if (!m) return null;

  const [, year, month, day, hour, minute, second, ms] = m;
  const d = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms)
  );
  const time = d.getTime();
  return Number.isNaN(time) ? null : time;
}

/* ------------------------------------------------------------------ */
/* Directory helpers                                                  */
/* ------------------------------------------------------------------ */

export function getDefaultLogDirectories(): string[] {
  const dirs: string[] = [];
  const home = os.homedir();
  const platform = process.platform;

  const devOverride = process.env.TLCLA_DEV_LOG_DIR;
  if (devOverride && devOverride.trim()) {
    dirs.push(devOverride.trim());
  }

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA;
    if (localAppData) {
      dirs.push(path.join(localAppData, "TL", "Saved", "CombatLogs"));
    }
  } else if (platform === "darwin") {
    dirs.push(
      path.join(
        home,
        "Library",
        "Application Support",
        "TL",
        "Saved",
        "CombatLogs"
      )
    );
  } else {
    dirs.push("/mnt/c/Users/User/AppData/Local/TL/Saved/CombatLogs");
    dirs.push(path.join(home, ".local", "share", "TL", "Saved", "CombatLogs"));
  }

  return dirs;
}

export async function listLogFilesInDirectory(
  directory: string
): Promise<LogFileInfo[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const candidates = entries.filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name).toLowerCase();
      return ext === ".txt" || ext === ".csv";
    });

    const files = (
      await Promise.all(
        candidates.map(async (entry) => {
          try {
            const fullPath = path.join(directory, entry.name);
            const stat = await fs.stat(fullPath);

            return {
              name: entry.name,
              path: fullPath,
              size: stat.size,
              modifiedAt: stat.mtimeMs,
            } as LogFileInfo;
          } catch (err) {
            console.warn(
              `[logs:listFiles] failed to stat ${entry.name}:`,
              err
            );
            return null;
          }
        })
      )
    ).filter((item): item is LogFileInfo => item != null);

    files.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return files;
  } catch (err) {
    console.error("[logs:listFiles] failed:", err);
    return [];
  }
}

export async function deleteLogFile(filePath: string): Promise<void> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error("Log path is not a file.");
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".txt" && ext !== ".csv") {
    throw new Error("Unsupported log file type.");
  }
  await fs.unlink(filePath);
}

/* ------------------------------------------------------------------ */
/* Parsing                                                            */
/* ------------------------------------------------------------------ */

export async function parseLogFileSummary(
  filePath: string
): Promise<ParsedLogSummary> {
  const fileName = path.basename(filePath);
  const emptySummary = (): ParsedLogSummary => ({
    filePath,
    fileName,
    characterName: null,
    totalEvents: 0,
    durationSeconds: null,
    startTime: null,
    endTime: null,
    totalDamage: 0,
    totalHealing: 0,
    dps: null,
    hps: null,
    critRate: null,
    skills: [],
    targets: [],
    perTargetSkills: {},
    perTargetSessions: {},
    timeline: [],
  });

  return new Promise((resolve, reject) => {
    let sawDataRow = false;

    let totalEvents = 0;
    let totalDamage = 0;
    let totalHealing = 0;
    let globalCritHits = 0;

    let firstTimestamp: number | null = null;
    let lastTimestamp: number | null = null;

    const skillsMap = new Map<string, SkillAccumulator>();
    const targetsMap = new Map<string, TargetAccumulator>();
    const perTargetSkillsMap = new Map<string, Map<string, SkillAccumulator>>();
    const bucketMap = new Map<number, BucketAccumulator>();
    const perTargetSessionsState = new Map<string, TargetSessionsState>();
    const casterDamageMap = new Map<string, number>();

    const GAP_MS = 8000;

    const handleRow = (row: RawRow) => {
      const logType = (row.LogType ?? "").trim();
      if (logType !== "DamageDone") return;

      const tsMs = parseTlTimestamp(row.Timestamp);
      if (tsMs != null) {
        if (firstTimestamp == null || tsMs < firstTimestamp) {
          firstTimestamp = tsMs;
        }
        if (lastTimestamp == null || tsMs > lastTimestamp) {
          lastTimestamp = tsMs;
        }
      }

      const damage = Number(row.Damage ?? "");
      if (!Number.isFinite(damage) || damage === 0) return;

      const skillName = (row.SkillName ?? "").trim() || "Unknown skill";
      const targetName = (row.TargetName ?? "").trim() || "Unknown target";
      const casterName = (row.CasterName ?? "").trim();
      const crit = (row.HitCritical ?? "") === "1";
      const heavy = isHeavyAttack(row.HitType, row.HitDouble);

      totalEvents += 1;
      totalDamage += damage;
      if (crit) globalCritHits += 1;

      // Overall skills
      {
        const existing =
          skillsMap.get(skillName) ||
          ({
            skillName,
            totalHits: 0,
            totalDamage: 0,
            maxHit: 0,
            sumHit: 0,
            critHits: 0,
            heavyHits: 0,
            heavyDamage: 0,
            minHit: Number.POSITIVE_INFINITY,
            normalMin: Number.POSITIVE_INFINITY,
            normalMax: 0,
            normalDamage: 0,
            normalHits: 0,
            critDamage: 0,
            critMin: Number.POSITIVE_INFINITY,
            critMax: 0,
            heavyMin: Number.POSITIVE_INFINITY,
            heavyMax: 0,
          } as SkillAccumulator);

        existing.totalHits += 1;
        existing.totalDamage += damage;
        existing.sumHit += damage;
        if (damage < existing.minHit) existing.minHit = damage;
        if (damage > existing.maxHit) existing.maxHit = damage;
        if (crit) {
          existing.critHits += 1;
          existing.critDamage += damage;
          if (damage < existing.critMin) existing.critMin = damage;
          if (damage > existing.critMax) existing.critMax = damage;
        } else {
          existing.normalHits += 1;
          existing.normalDamage += damage;
          if (damage < existing.normalMin) existing.normalMin = damage;
          if (damage > existing.normalMax) existing.normalMax = damage;
        }
        if (heavy) {
          existing.heavyHits += 1;
          existing.heavyDamage += damage;
          if (damage < existing.heavyMin) existing.heavyMin = damage;
          if (damage > existing.heavyMax) existing.heavyMax = damage;
        }
        skillsMap.set(skillName, existing);
      }

      // Per-target totals
      {
        const existing =
          targetsMap.get(targetName) ||
          ({
            targetName,
            totalHits: 0,
            totalDamage: 0,
            maxHit: 0,
            sumHit: 0,
            critHits: 0,
          } as TargetAccumulator);

        existing.totalHits += 1;
        existing.totalDamage += damage;
        existing.sumHit += damage;
        if (damage > existing.maxHit) existing.maxHit = damage;
        if (crit) existing.critHits += 1;
        targetsMap.set(targetName, existing);
      }

      // Per-target skills (overall)
      {
        let skillsForTarget = perTargetSkillsMap.get(targetName);
        if (!skillsForTarget) {
          skillsForTarget = new Map<string, SkillAccumulator>();
          perTargetSkillsMap.set(targetName, skillsForTarget);
        }

        const existing =
          skillsForTarget.get(skillName) ||
          ({
            skillName,
            totalHits: 0,
            totalDamage: 0,
            maxHit: 0,
            sumHit: 0,
            critHits: 0,
            heavyHits: 0,
            heavyDamage: 0,
            minHit: Number.POSITIVE_INFINITY,
            normalMin: Number.POSITIVE_INFINITY,
            normalMax: 0,
            normalDamage: 0,
            normalHits: 0,
            critDamage: 0,
            critMin: Number.POSITIVE_INFINITY,
            critMax: 0,
            heavyMin: Number.POSITIVE_INFINITY,
            heavyMax: 0,
          } as SkillAccumulator);

        existing.totalHits += 1;
        existing.totalDamage += damage;
        existing.sumHit += damage;
        if (damage < existing.minHit) existing.minHit = damage;
        if (damage > existing.maxHit) existing.maxHit = damage;
        if (crit) {
          existing.critHits += 1;
          existing.critDamage += damage;
          if (damage < existing.critMin) existing.critMin = damage;
          if (damage > existing.critMax) existing.critMax = damage;
        } else {
          existing.normalHits += 1;
          existing.normalDamage += damage;
          if (damage < existing.normalMin) existing.normalMin = damage;
          if (damage > existing.normalMax) existing.normalMax = damage;
        }
        if (heavy) {
          existing.heavyHits += 1;
          existing.heavyDamage += damage;
          if (damage < existing.heavyMin) existing.heavyMin = damage;
          if (damage > existing.heavyMax) existing.heavyMax = damage;
        }
        skillsForTarget.set(skillName, existing);
      }

      // Timeline buckets
      if (tsMs != null) {
        const bucketKey = Math.floor(tsMs / 1000) * 1000;
        const bucket =
          bucketMap.get(bucketKey) ||
          ({
            totalDamage: 0,
            perTarget: new Map<string, number>(),
            perTargetSkills: new Map<
              string,
              Map<string, TimelineSkillAccumulator>
            >(),
          } as BucketAccumulator);

        bucket.totalDamage += damage;
        const current = bucket.perTarget.get(targetName) ?? 0;
        bucket.perTarget.set(targetName, current + damage);

        let skillsForTarget = bucket.perTargetSkills.get(targetName);
        if (!skillsForTarget) {
          skillsForTarget = new Map<string, TimelineSkillAccumulator>();
          bucket.perTargetSkills.set(targetName, skillsForTarget);
        }

        const existingSkill =
          skillsForTarget.get(skillName) ||
          ({
            skillName,
            damage: 0,
            hits: 0,
            critHits: 0,
            heavyHits: 0,
          } as TimelineSkillAccumulator);

        existingSkill.damage += damage;
        existingSkill.hits += 1;
        if (crit) existingSkill.critHits += 1;
        if (heavy) existingSkill.heavyHits += 1;
        skillsForTarget.set(skillName, existingSkill);

        bucketMap.set(bucketKey, bucket);
      }

      // Per-target sessions
      if (tsMs != null) {
        let state = perTargetSessionsState.get(targetName);
        if (!state) {
          state = { sessions: [] };
          perTargetSessionsState.set(targetName, state);
        }

        const lastMs = state.lastEventMs;
        let current = state.current;

        if (!current) {
          current = {
            id: state.sessions.length + 1,
            startMs: tsMs,
            endMs: tsMs,
            totalDamage: 0,
            totalEvents: 0,
            totalCritHits: 0,
            skills: new Map<string, SkillAccumulator>(),
          };
          state.current = current;
          state.sessions.push(current);
        } else if (lastMs != null && tsMs - lastMs > GAP_MS) {
          current = {
            id: state.sessions.length + 1,
            startMs: tsMs,
            endMs: tsMs,
            totalDamage: 0,
            totalEvents: 0,
            totalCritHits: 0,
            skills: new Map<string, SkillAccumulator>(),
          };
          state.current = current;
          state.sessions.push(current);
        } else {
          current.endMs = tsMs;
        }

        current.totalDamage += damage;
        current.totalEvents += 1;
        if (crit) current.totalCritHits += 1;

        const existingSessionSkill =
          current.skills.get(skillName) ||
          ({
            skillName,
            totalHits: 0,
            totalDamage: 0,
            maxHit: 0,
            sumHit: 0,
            critHits: 0,
            heavyHits: 0,
            heavyDamage: 0,
            minHit: Number.POSITIVE_INFINITY,
            normalMin: Number.POSITIVE_INFINITY,
            normalMax: 0,
            normalDamage: 0,
            normalHits: 0,
            critDamage: 0,
            critMin: Number.POSITIVE_INFINITY,
            critMax: 0,
            heavyMin: Number.POSITIVE_INFINITY,
            heavyMax: 0,
          } as SkillAccumulator);

        existingSessionSkill.totalHits += 1;
        existingSessionSkill.totalDamage += damage;
        existingSessionSkill.sumHit += damage;
        if (damage < existingSessionSkill.minHit) {
          existingSessionSkill.minHit = damage;
        }
        if (damage > existingSessionSkill.maxHit) {
          existingSessionSkill.maxHit = damage;
        }
        if (crit) {
          existingSessionSkill.critHits += 1;
          existingSessionSkill.critDamage += damage;
          if (damage < existingSessionSkill.critMin) {
            existingSessionSkill.critMin = damage;
          }
          if (damage > existingSessionSkill.critMax) {
            existingSessionSkill.critMax = damage;
          }
        } else {
          existingSessionSkill.normalHits += 1;
          existingSessionSkill.normalDamage += damage;
          if (damage < existingSessionSkill.normalMin) {
            existingSessionSkill.normalMin = damage;
          }
          if (damage > existingSessionSkill.normalMax) {
            existingSessionSkill.normalMax = damage;
          }
        }
        if (heavy) {
          existingSessionSkill.heavyHits += 1;
          existingSessionSkill.heavyDamage += damage;
          if (damage < existingSessionSkill.heavyMin) {
            existingSessionSkill.heavyMin = damage;
          }
          if (damage > existingSessionSkill.heavyMax) {
            existingSessionSkill.heavyMax = damage;
          }
        }
        current.skills.set(skillName, existingSessionSkill);

        state.lastEventMs = tsMs;
      }
      // Player/caster inference
      if (casterName) {
        const prev = casterDamageMap.get(casterName) ?? 0;
        casterDamageMap.set(casterName, prev + damage);
      }
    };

    const toField = (value: unknown): string =>
      value == null ? "" : String(value);

    const handleCells = (cells: unknown[]) => {
      if (!Array.isArray(cells) || cells.length === 0) return;

      const firstCell = toField(cells[0]).trim();
      if (!sawDataRow && firstCell.startsWith("CombatLogVersion")) {
        return;
      }

      sawDataRow = true;

      const row: RawRow = {
        Timestamp: toField(cells[0]),
        LogType: toField(cells[1]),
        SkillName: toField(cells[2]),
        SkillId: toField(cells[3]),
        Damage: toField(cells[4]),
        HitCritical: toField(cells[5]),
        HitDouble: toField(cells[6]),
        HitType: toField(cells[7]),
        CasterName: toField(cells[8]),
        TargetName: toField(cells[9]),
      };

      handleRow(row);
    };

    const stream = createReadStream(filePath, { encoding: "utf8" });

    Papa.parse(stream, {
      header: false,
      skipEmptyLines: "greedy",
      chunk: (results) => {
        if (!Array.isArray(results.data)) return;
        for (const cells of results.data) {
          if (!Array.isArray(cells)) continue;
          handleCells(cells);
        }
      },
      error: (error) => {
        reject(error);
      },
      complete: () => {
        if (!sawDataRow) {
          resolve(emptySummary());
          return;
        }

        const characterName = (() => {
          if (casterDamageMap.size === 0) return null;
          let bestName: string | null = null;
          let bestDamage = -Infinity;
          casterDamageMap.forEach((total, name) => {
            if (total > bestDamage) {
              bestDamage = total;
              bestName = name;
            }
          });
          return bestName;
        })();

        const durationSeconds =
          firstTimestamp != null &&
          lastTimestamp != null &&
          lastTimestamp > firstTimestamp
            ? (lastTimestamp - firstTimestamp) / 1000
            : null;

        const dps =
          durationSeconds && durationSeconds > 0
            ? totalDamage / durationSeconds
            : null;

        const globalCritRate =
          totalEvents > 0 ? (globalCritHits / totalEvents) * 100 : null;

        const roundOrNull = (value: number): number | null =>
          Number.isFinite(value) ? Math.round(value) : null;

        const toSkillBreakdown = (s: SkillAccumulator): SkillBreakdown => {
          const avgHit =
            s.totalHits > 0 ? Number((s.sumHit / s.totalHits).toFixed(1)) : 0;
          const critRate =
            s.totalHits > 0 ? (s.critHits / s.totalHits) * 100 : 0;
          const heavyRate =
            s.totalHits > 0 ? (s.heavyHits / s.totalHits) * 100 : 0;
          const normalAvg =
            s.normalHits > 0
              ? Number((s.normalDamage / s.normalHits).toFixed(1))
              : null;
          const critAvg =
            s.critHits > 0
              ? Number((s.critDamage / s.critHits).toFixed(1))
              : null;
          const heavyAvg =
            s.heavyHits > 0
              ? Number((s.heavyDamage / s.heavyHits).toFixed(1))
              : null;

          return {
            skillName: s.skillName,
            totalHits: s.totalHits,
            totalDamage: Math.round(s.totalDamage),
            maxHit: Math.round(s.maxHit),
            minHit: roundOrNull(s.minHit) ?? 0,
            avgHit,
            critHits: s.critHits,
            critRate: Number(critRate.toFixed(1)),
            heavyHits: s.heavyHits,
            heavyDamage: Math.round(s.heavyDamage),
            heavyRate: Number(heavyRate.toFixed(1)),
            normalMinHit: roundOrNull(s.normalMin),
            normalMaxHit: roundOrNull(s.normalMax),
            normalAvgHit: normalAvg,
            normalDamage: s.normalHits > 0 ? Math.round(s.normalDamage) : null,
            critDamage: s.critHits > 0 ? Math.round(s.critDamage) : null,
            critMinHit: roundOrNull(s.critMin),
            critMaxHit: roundOrNull(s.critMax),
            critAvgHit: critAvg,
            heavyMinHit: roundOrNull(s.heavyMin),
            heavyMaxHit: roundOrNull(s.heavyMax),
            heavyAvgHit: heavyAvg,
          };
        };

        const skills: SkillBreakdown[] = Array.from(skillsMap.values())
          .map(toSkillBreakdown)
          .sort((a, b) => b.totalDamage - a.totalDamage);

        const targets: TargetBreakdown[] = Array.from(targetsMap.values())
          .map((t) => ({
            targetName: t.targetName,
            totalHits: t.totalHits,
            totalDamage: Math.round(t.totalDamage),
            maxHit: Math.round(t.maxHit),
            avgHit:
              t.totalHits > 0 ? Number((t.sumHit / t.totalHits).toFixed(1)) : 0,
            critHits: t.critHits,
            critRate:
              t.totalHits > 0
                ? Number(((t.critHits / t.totalHits) * 100).toFixed(1))
                : 0,
          }))
          .sort((a, b) => b.totalDamage - a.totalDamage);

        const perTargetSkills: PerTargetSkillsMap = {};
        perTargetSkillsMap.forEach((skillsForTarget, targetName) => {
          const arr: SkillBreakdown[] = Array.from(skillsForTarget.values())
            .map(toSkillBreakdown)
            .sort((a, b) => b.totalDamage - a.totalDamage);

          perTargetSkills[targetName] = arr;
        });

        const perTargetSessions: PerTargetSessionsMap = {};
        const sessionBase = firstTimestamp;
        if (sessionBase != null) {
          perTargetSessionsState.forEach((state, targetName) => {
            const summaries: TargetSessionSummary[] = state.sessions
              .filter((s) => s.totalDamage > 0 && s.totalEvents > 0)
              .map((s) => {
                const skillsArray: SkillBreakdown[] = Array.from(
                  s.skills.values()
                )
                  .map(toSkillBreakdown)
                  .sort((a, b) => b.totalDamage - a.totalDamage);

                const duration =
                  s.endMs > s.startMs ? (s.endMs - s.startMs) / 1000 : 0;
                const critRate =
                  s.totalEvents > 0
                    ? Number(
                        ((s.totalCritHits / s.totalEvents) * 100).toFixed(1)
                      )
                    : 0;

                return {
                  sessionId: s.id,
                  startElapsed: (s.startMs - sessionBase) / 1000,
                  endElapsed: (s.endMs - sessionBase) / 1000,
                  durationSeconds: duration,
                  totalDamage: Math.round(s.totalDamage),
                  totalEvents: s.totalEvents,
                  critHits: s.totalCritHits,
                  critRate,
                  skills: skillsArray,
                };
              });

            if (summaries.length > 0) {
              perTargetSessions[targetName] = summaries;
            }
          });
        }

        const bucketEntries = Array.from(bucketMap.entries()).sort(
          (a, b) => a[0] - b[0]
        );
        const firstBucketTs =
          bucketEntries.length > 0 ? bucketEntries[0][0] : null;
        const lastBucketTs =
          bucketEntries.length > 0
            ? bucketEntries[bucketEntries.length - 1][0]
            : null;

        const timeline: DamageTimelineBucket[] = [];
        if (firstBucketTs != null && lastBucketTs != null) {
          for (let ts = firstBucketTs; ts <= lastBucketTs; ts += 1000) {
            const bucket =
              bucketMap.get(ts) ||
              ({
                totalDamage: 0,
                perTarget: new Map<string, number>(),
                perTargetSkills: new Map<
                  string,
                  Map<string, TimelineSkillAccumulator>
                >(),
              } as BucketAccumulator);

            const perTarget: Record<string, number> = {};
            bucket.perTarget.forEach((value, name) => {
              perTarget[name] = Math.round(value);
            });

            const skills: Record<string, TimelineSkillContribution[]> = {};
            bucket.perTargetSkills.forEach((skillsForTarget, targetName) => {
              const all = Array.from(skillsForTarget.values())
                .sort((a, b) => b.damage - a.damage)
                .map((s) => ({
                  skillName: s.skillName,
                  damage: Math.round(s.damage),
                  hits: s.hits,
                  critHits: s.critHits,
                  heavyHits: s.heavyHits,
                }));
              if (all.length) skills[targetName] = all;
            });

            timeline.push({
              timestampMs: ts,
              elapsedSeconds: (ts - firstBucketTs) / 1000,
              totalDamage: Math.round(bucket.totalDamage),
              perTarget,
              skills: Object.keys(skills).length ? skills : undefined,
            });
          }
        }

        resolve({
          filePath,
          fileName,
          characterName,
          totalEvents,
          durationSeconds:
            durationSeconds != null ? Number(durationSeconds.toFixed(1)) : null,
          startTime:
            firstTimestamp != null
              ? new Date(firstTimestamp).toISOString()
              : null,
          endTime:
            lastTimestamp != null ? new Date(lastTimestamp).toISOString() : null,
          totalDamage: Math.round(totalDamage),
          totalHealing: Math.round(totalHealing),
          dps: dps != null ? Number(dps.toFixed(1)) : null,
          hps: null,
          critRate:
            globalCritRate != null ? Number(globalCritRate.toFixed(1)) : null,
          skills,
          targets,
          perTargetSkills,
          perTargetSessions,
          timeline,
        });
      },
    });
  });
}
