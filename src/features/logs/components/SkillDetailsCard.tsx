import React from "react";
import { Box, Typography } from "@mui/material";
import { LoadState, SkillBreakdown } from "../types/logTypes";
import {
  formatInteger,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { ExtendedSkillBreakdown } from "../utils/logsViewUtils";
import { getSkillIconPath } from "./SkillsTableSection";
import { cardGap, cardPaddingX, cardPaddingY } from "./layoutTokens";
import { scrollBarStyles } from "../utils/logsViewUtils";

const formatDamageInt = (value: number | null | undefined): string =>
  value == null ? "–" : formatInteger(value);

const formatDamageAvg = (value: number | null | undefined): string =>
  value == null ? "–" : formatNumber(value, 1);

const formatDpsValue = (value: number | null | undefined): string =>
  value == null ? "–" : formatNumber(value, 1);

interface SkillDetailsCardProps {
  summaryState: LoadState;
  currentTopSkills: SkillBreakdown[];
  currentDurationSeconds: number | null;
  selectedSkill: ExtendedSkillBreakdown | null;
  maxHeight?: number | null;
}

type SectionData = {
  title: string;
  stats: { label: string; value: string }[];
  sideStats: { label: string; value: string }[];
};

export const SkillDetailsCard: React.FC<SkillDetailsCardProps> = ({
  summaryState,
  currentTopSkills,
  currentDurationSeconds,
  selectedSkill,
  maxHeight = null,
}) => {
  const featuredSkill =
    summaryState === "loaded"
      ? selectedSkill ??
        (currentTopSkills[0] as ExtendedSkillBreakdown | undefined)
      : undefined;

  const durationSeconds =
    currentDurationSeconds && currentDurationSeconds > 0
      ? currentDurationSeconds
      : null;

  const sections = featuredSkill
    ? buildSectionsForSkill(featuredSkill, durationSeconds)
    : [];

  return (
    <Box
      sx={{
        borderRadius: "2px",
        px: cardPaddingX,
        py: cardPaddingY,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,12,24,0.96))",
        boxShadow: "0 18px 32px rgba(2,6,23,0.7), 0 0 0 1px rgba(15,23,42,0.9)",
        display: "flex",
        flexDirection: "column",
        gap: cardGap,
        height: "auto",
        maxHeight: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.95rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(226,232,240,0.7)",
        }}
      >
        Attack Breakdown
      </Typography>

      {sections.length > 0 ? (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
            }}
          >
            {featuredSkill && getSkillIconPath(featuredSkill.skillName) && (
              <Box
                component="img"
                src={getSkillIconPath(featuredSkill.skillName)}
                alt={featuredSkill.skillName}
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 1,
                  objectFit: "cover",
                }}
              />
            )}
            <Typography sx={{ fontSize: "1.8rem", fontWeight: 700 }}>
              {featuredSkill?.skillName}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              pr: 0.5,
              ...scrollBarStyles,
            }}
          >
            {sections.map((section) => (
              <SkillDetailSection key={section.title} data={section} />
            ))}
          </Box>
        </>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
            Select a skill to see its breakdown.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const SkillDetailSection = ({ data }: { data: SectionData }) => (
  <Box
    sx={{
      borderRadius: "2px",
      border: "1px solid rgba(42,53,79,0.85)",
      backgroundColor: "rgba(6,9,18,0.92)",
      px: 1.8,
      py: 1.2,
      display: "flex",
      flexDirection: "column",
      gap: 1.1,
    }}
  >
    <Box
      sx={{
        position: "relative",
        mx: -1.8,
        mt: -1.2,
      }}
    >
      <Typography
        sx={{
          fontSize: "1rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgba(248,250,252,0.9)",
          background:
            "linear-gradient(90deg, rgba(17,24,39,1), rgba(15,23,42,1))",
          px: 1.4,
          py: 0.6,
        }}
      >
        {data.title}
      </Typography>
    </Box>
    <GridStats
      stats={data.stats}
      sideStats={data.sideStats}
      emphasizeSide={data.title === "Basic Attack"}
    />
  </Box>
);

const GridStats = ({
  stats,
  sideStats,
}: {
  stats: { label: string; value: string }[];
  sideStats: { label: string; value: string }[];
}) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      columnGap: 2,
      alignItems: "stretch",
    }}
  >
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
      {stats.map((stat) => (
        <StatRow key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </Box>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.6,
        pl: 2,
        borderLeft: "1px solid rgba(55,65,81,0.6)",
      }}
    >
      {sideStats.map((stat) => (
        <StatRow key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </Box>
  </Box>
);

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: "1.05rem",
      color: "rgba(226,232,240,0.85)",
    }}
  >
    <Typography sx={{ fontSize: "0.95rem", color: "rgba(148,163,184,0.9)" }}>
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
  </Box>
);

const buildSectionsForSkill = (
  skill: ExtendedSkillBreakdown,
  durationSeconds: number | null
): SectionData[] => {
  const totalHits = skill.totalHits ?? 0;
  const totalDamage = skill.totalDamage ?? 0;
  const critHits = skill.critHits ?? 0;
  const heavyHits = skill.heavyHits ?? 0;
  const baseHits = Math.max(totalHits - critHits, 0);

  const critDamage =
    skill.critDamage ??
    (totalHits > 0 ? (critHits / totalHits) * totalDamage : 0);
  const heavyDamage = skill.heavyDamage ?? 0;
  const baseDamage =
    skill.normalDamage ?? Math.max(totalDamage - critDamage, 0);

  const baseAvg =
    skill.normalAvgHit ??
    (baseHits > 0 ? Number((baseDamage / baseHits).toFixed(1)) : null);
  const critAvg =
    skill.critAvgHit ??
    (critHits > 0 ? Number((critDamage / critHits).toFixed(1)) : null);
  const heavyAvg =
    skill.heavyAvgHit ??
    (heavyHits > 0 ? Number((heavyDamage / heavyHits).toFixed(1)) : null);

  const baseMin = skill.normalMinHit ?? skill.minHit ?? null;
  const baseMax = skill.normalMaxHit ?? skill.maxHit ?? null;
  const critMin = skill.critMinHit ?? null;
  const critMax = skill.critMaxHit ?? null;
  const heavyMin = skill.heavyMinHit ?? null;
  const heavyMax = skill.heavyMaxHit ?? null;

  const baseRatio = totalHits > 0 ? (baseHits / totalHits) * 100 : null;
  const critRatio =
    skill.critRate ?? (totalHits > 0 ? (critHits / totalHits) * 100 : null);
  const heavyRatio =
    skill.heavyRate ?? (totalHits > 0 ? (heavyHits / totalHits) * 100 : null);

  const baseDps =
    durationSeconds && baseDamage > 0 ? baseDamage / durationSeconds : null;
  const critDps =
    durationSeconds && critDamage > 0 ? critDamage / durationSeconds : null;
  const heavyDps =
    durationSeconds && heavyDamage > 0 ? heavyDamage / durationSeconds : null;

  const basicSection: SectionData = {
    title: "Basic Attack",
    stats: [
      { label: "Min", value: formatDamageInt(baseMin) },
      { label: "Max", value: formatDamageInt(baseMax) },
      { label: "Average", value: formatDamageAvg(baseAvg) },
    ],
    sideStats: [
      { label: "Ratio", value: formatPercent(baseRatio) },
      { label: "DPS", value: formatDpsValue(baseDps) },
    ],
  };

  const critSection: SectionData = {
    title: "Critical Hit Chance",
    stats: [
      { label: "Min", value: formatDamageInt(critMin) },
      { label: "Max", value: formatDamageInt(critMax) },
      { label: "Average", value: formatDamageAvg(critAvg) },
    ],
    sideStats: [
      { label: "Ratio", value: formatPercent(critRatio) },
      { label: "DPS", value: formatDpsValue(critDps) },
    ],
  };

  const heavySection: SectionData = {
    title: "Heavy Attack",
    stats: [
      { label: "Min", value: formatDamageInt(heavyMin) },
      { label: "Max", value: formatDamageInt(heavyMax) },
      { label: "Average", value: formatDamageAvg(heavyAvg) },
    ],
    sideStats: [
      { label: "Ratio", value: formatPercent(heavyRatio) },
      { label: "DPS", value: formatDpsValue(heavyDps) },
    ],
  };

  return [basicSection, critSection, heavySection];
};
