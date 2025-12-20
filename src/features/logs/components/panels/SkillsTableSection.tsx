// src/features/logs/components/panels/SkillsTableSection.tsx
import React, { useMemo } from "react";
import {
  Box,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import { LoadState, LogFileInfo, SkillBreakdown } from "../../types/logTypes";
import {
  ExtendedSkillBreakdown,
  scrollBarStyles,
} from "../../utils/logsViewUtils";
import { formatInteger } from "../../utils/formatters";
import skillsData from "../../../../assets/skills.json";
import masterySkillsData from "../../../../assets/weaponMasterySkills.json";
import skillCoresData from "../../../../assets/skillCores.json";
import placeholderLogo from "../../../../../resources/logo.png?inline";

const iconAssets = import.meta.glob<string>(
  "../../../../assets/icons/{crossbow,daggers,greatsword,longbow,mastery,orb,spear,staff,sword-shield,wand,skill-cores}/**/*",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
) as Record<string, string>;

// ---- Skill icon lookup -----------------------------------------------------

interface SkillMeta {
  name: string;
  iconPath: string | null;
}

interface MasterySkillMeta {
  name: string;
  iconPath: string;
}

interface SkillCoreMeta {
  name: string;
  image: string;
}

// Normalize a name so we can match "Detonation Mark" with
// "Detonation Mark Active Deals 280% of Base Damage..."
const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Try to trim suffixes like " Active", " Common", " Weapon Mastery..."
const getBaseSkillName = (name: string) => {
  const cutMarkers = [" Active", " Common", " Weapon Mastery"];
  for (const marker of cutMarkers) {
    const idx = name.indexOf(marker);
    if (idx > 0) {
      return name.slice(0, idx);
    }
  }
  return name;
};

const resolveIconAssetUrl = (rawPath: string): string | undefined => {
  let cleaned = rawPath.replace(/^src\//, "");

  if (!cleaned.startsWith("assets/")) {
    if (cleaned.startsWith("icons/") || cleaned.startsWith("images/")) {
      cleaned = `assets/${cleaned}`;
    }
  }

  const assetKey = `../../../../${cleaned}`;
  return iconAssets[assetKey];
};

const skillIconMap = (() => {
  const map = new Map<string, string>();

  const entries: Array<SkillMeta | MasterySkillMeta | SkillCoreMeta> = [
    ...(skillsData as SkillMeta[]),
    ...(masterySkillsData as MasterySkillMeta[]),
    ...(skillCoresData as SkillCoreMeta[]),
  ];

  entries.forEach((s) => {
    const iconPath = "iconPath" in s ? s.iconPath : s.image;
    if (!iconPath) return;

    const assetUrl = resolveIconAssetUrl(iconPath);
    if (!assetUrl) return;

    const fullNorm = normalizeName(s.name);
    if (!map.has(fullNorm)) {
      map.set(fullNorm, assetUrl);
    }

    const baseName = getBaseSkillName(s.name);
    const baseNorm = normalizeName(baseName);
    if (baseNorm && !map.has(baseNorm)) {
      map.set(baseNorm, assetUrl);
    }
  });

  return map;
})();

export const getSkillIconPath = (skillName: string): string | undefined => {
  const norm = normalizeName(skillName);
  return (
    skillIconMap.get(norm) ??
    skillIconMap.get(normalizeName(getBaseSkillName(skillName)))
  );
};

// ---------------------------------------------------------------------------

export interface SkillsTableSectionProps {
  summaryState: LoadState;
  summaryError: string | null;
  selectedLog: LogFileInfo | null;
  currentTopSkills: SkillBreakdown[];
  currentTotalDamage: number;
  sortKey?: SkillsTableSortKey | null;
  sortDirection?: SkillsTableSortDirection;
  onSelectSkill?: (skill: ExtendedSkillBreakdown) => void;
  selectedSkillName?: string | null;
}

export type SkillsTableSortKey =
  | "damage"
  | "share"
  | "hits"
  | "crit"
  | "heavy"
  | "critHeavy";

export type SkillsTableSortDirection = "asc" | "desc";

export const SkillsTableSection: React.FC<SkillsTableSectionProps> = React.memo(
  ({
    summaryState,
    summaryError,
    selectedLog,
    currentTopSkills,
    currentTotalDamage,
    sortKey,
    sortDirection,
    onSelectSkill,
    selectedSkillName,
  }) => {
    if (summaryState === "idle" && !selectedLog) {
      return (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary" sx={{ fontSize: "1.17rem" }}>
            Select a log to see skill breakdown.
          </Typography>
        </Box>
      );
    }

    if (summaryState === "loading") {
      return (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
          }}
        >
          <CircularProgress size={24} />
          <Typography color="text.secondary" sx={{ fontSize: "1.17rem" }}>
            Parsing log and computing metrics...
          </Typography>
        </Box>
      );
    }

    if (summaryState === "error" && summaryError) {
      return (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="error" sx={{ fontSize: "1.17rem" }}>
            {summaryError}
          </Typography>
        </Box>
      );
    }

    if (summaryState === "loaded" && currentTopSkills.length === 0) {
      return (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary" sx={{ fontSize: "1.17rem" }}>
            No damage skills found for this scope.
          </Typography>
        </Box>
      );
    }

    const extendedSkills = currentTopSkills as ExtendedSkillBreakdown[];

      const { rows: baseRows, totalHits, totalCritHits, totalHeavyDamage, totalHeavyHits } =
        useMemo(() => {
          let hitsSum = 0;
          let critHitsSum = 0;
          let heavyDamageSum = 0;
          let heavyHitsSum = 0;

        const mapped = extendedSkills.map((s, index) => {
          const hits = s.totalHits ?? 0;
          const critRate = s.critRate ?? 0;
          const critHits =
            s.critHits != null ? s.critHits : hits * (critRate / 100);

          const heavyDamage =
            s.heavyDamage != null ? s.heavyDamage : s.maxHit ?? 0;
          const heavyHitsFromSource =
            s.heavyHits != null
              ? s.heavyHits
              : s.heavyRate != null && hits > 0
              ? (s.heavyRate / 100) * hits
              : null;
          const heavyRate =
            s.heavyRate != null
              ? s.heavyRate
              : heavyHitsFromSource != null && hits > 0
              ? (heavyHitsFromSource / hits) * 100
              : s.totalDamage > 0
              ? (heavyDamage / s.totalDamage) * 100
              : 0;

          hitsSum += hits;
          critHitsSum += critHits;
          heavyDamageSum += heavyDamage;
          if (heavyHitsFromSource != null) {
            heavyHitsSum += heavyHitsFromSource;
          }

          const share =
            currentTotalDamage > 0
              ? (s.totalDamage / currentTotalDamage) * 100
              : 0;

            return {
              key: `${s.skillName}-${index}`,
              skill: s,
              hits,
              share,
              critRate,
              heavyRate,
              critHeavyRate: critRate + heavyRate,
              iconPath: getSkillIconPath(s.skillName),
              index,
            };
          });

        return {
          rows: mapped,
          totalHits: hitsSum,
          totalCritHits: critHitsSum,
          totalHeavyDamage: heavyDamageSum,
          totalHeavyHits: heavyHitsSum,
        };
      }, [extendedSkills, currentTotalDamage]);

      const rows = useMemo(() => {
        if (!sortKey) return baseRows;
        const direction = sortDirection === "asc" ? 1 : -1;

        const valueFor = (row: (typeof baseRows)[number]): number => {
          switch (sortKey) {
            case "damage":
              return row.skill.totalDamage ?? 0;
            case "share":
              return row.share ?? 0;
            case "hits":
              return row.hits ?? 0;
            case "crit":
              return row.critRate ?? 0;
            case "heavy":
              return row.heavyRate ?? 0;
            case "critHeavy":
              return row.critHeavyRate ?? 0;
            default:
              return 0;
          }
        };

      const sorted = [...baseRows].sort((a, b) => {
        const av = valueFor(a);
        const bv = valueFor(b);
        if (av === bv) return a.index - b.index;
        return av < bv ? -1 * direction : 1 * direction;
      });

      return sorted;
    }, [baseRows, sortDirection, sortKey]);

    const totalCritRate = totalHits > 0 ? (totalCritHits / totalHits) * 100 : 0;
    const totalHeavyRate =
      totalHeavyHits > 0 && totalHits > 0
        ? (totalHeavyHits / totalHits) * 100
        : currentTotalDamage > 0
        ? (totalHeavyDamage / currentTotalDamage) * 100
        : 0;

    return (
      <Box
        sx={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background:
            "radial-gradient(circle at top, rgba(15,23,42,0.98), rgba(5,8,20,1))",
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              display: "flex",
              flexDirection: "column",
              ...scrollBarStyles,
            }}
          >
              {rows.map(
                ({
                  key,
                  skill,
                  share,
                  iconPath,
                  heavyRate,
                  critRate,
                  critHeavyRate,
                  index,
                }) => {
                  const isTop = index === 0;
                  const isSelected = selectedSkillName === skill.skillName;
                  const defaultBg = isTop ? "rgba(55,48,163,0.5)" : "transparent";
                  const oddBg = isTop
                    ? "rgba(55,48,163,0.55)"
                  : "rgba(15,23,42,0.92)";
                const hasSkillIcon = Boolean(iconPath);
                const resolvedIconSrc = iconPath ?? placeholderLogo;
                const iconEl = (
                  <Box
                    component="img"
                    src={resolvedIconSrc}
                    alt={skill.skillName}
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 1,
                      flexShrink: 0,
                      objectFit: "cover",
                      opacity: hasSkillIcon ? 1 : 0.92,
                    }}
                  />
                );

                return (
                  <Box
                    key={key}
                    sx={{
                      px: { xs: 1.4, md: 2 },
                        py: { xs: 0.8, md: 1.1 },
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "2.4fr 1.2fr 1.4fr",
                          sm: "2.4fr 1.2fr 1.6fr 1fr",
                          md: "2.4fr 1.4fr 1.8fr 1fr 1.2fr 1.2fr 1.2fr",
                        },
                        columnGap: { xs: 1.2, md: 2.2 },
                        alignItems: "center",
                        fontSize: { xs: "0.9rem", md: "1.08rem" },
                      borderBottom: "1px solid rgba(31,41,55,0.9)",
                      backgroundColor: isSelected
                        ? "rgba(37,99,235,0.25)"
                        : defaultBg,
                      cursor: onSelectSkill ? "pointer" : "default",
                      "&:nth-of-type(odd)": {
                        backgroundColor: isSelected
                          ? "rgba(37,99,235,0.3)"
                          : oddBg,
                      },
                      "&:hover": onSelectSkill
                        ? { backgroundColor: "rgba(37,99,235,0.35)" }
                          : undefined,
                        minWidth: 760,
                      }}
                      onClick={() => onSelectSkill?.(skill)}
                    >
                    {/* Skill name + icon */}
                    <Box
                      component="span"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: { xs: 0.8, md: 1 },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {hasSkillIcon ? (
                        iconEl
                      ) : (
                        <Tooltip
                          title="The correct skills image coming soon"
                          arrow
                          placement="top"
                        >
                          <Box component="span" sx={{ display: "inline-flex" }}>
                            {iconEl}
                          </Box>
                        </Tooltip>
                      )}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {skill.skillName}
                      </span>
                    </Box>

                    {/* Damage */}
                    <span>{formatInteger(skill.totalDamage)}</span>

                      {/* Ratio */}
                      <span>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                          gap: 1,
                          justifyContent: "flex-start",
                        }}
                      >
                        <Typography
                          sx={{
                            color: "text.secondary",
                            fontSize: "1.08rem",
                          }}
                        >
                          {share.toFixed(1)}%
                        </Typography>
                        <Box sx={{ width: { xs: 110, md: 140 } }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, share)}
                            sx={{
                              height: 10,
                              borderRadius: 999,
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 999,
                                background:
                                  "linear-gradient(90deg,#22c55e,#a3e635)",
                              },
                              backgroundColor: "rgba(15,23,42,1)",
                            }}
                          />
                        </Box>
                      </Box>
                    </span>

                    {/* Hits */}
                    <span>{formatInteger(skill.totalHits)}</span>

                    {/* Crit */}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {(critRate ?? 0).toFixed(1)}%
                    </span>

                      {/* Heavy */}
                      <span style={{ whiteSpace: "nowrap" }}>
                        {(heavyRate ?? 0).toFixed(1)}%
                      </span>

                      {/* Crit+Heavy */}
                      <span style={{ whiteSpace: "nowrap" }}>
                        {(critHeavyRate ?? 0).toFixed(1)}%
                      </span>
                    </Box>
                  );
                }
              )}
          </Box>
        </Box>

        {/* Totals row */}
          <Box
            sx={{
              px: { xs: 1.4, md: 2 },
              py: { xs: 0.8, md: 1.1 },
              display: "grid",
              gridTemplateColumns: {
                xs: "2.4fr 1.2fr 1.4fr",
                sm: "2.4fr 1.2fr 1.6fr 1fr",
                md: "2.4fr 1.4fr 1.8fr 1fr 1.2fr 1.2fr 1.2fr",
              },
              columnGap: { xs: 1.2, md: 2.2 },
              alignItems: "center",
              fontSize: { xs: "0.9rem", md: "1.08rem" },
              borderTop: "1px solid rgba(55,65,81,0.95)",
              backgroundColor: "rgba(15,23,42,1)",
              minWidth: 760,
            }}
          >
          <span style={{ fontWeight: 600 }}>Total</span>
          <span>{formatInteger(currentTotalDamage)}</span>
          <span>100%</span>
            <span>{formatInteger(totalHits)}</span>
            <span>{totalCritRate.toFixed(1)}%</span>
            <span>{totalHeavyRate.toFixed(1)}%</span>
            <span>{(totalCritRate + totalHeavyRate).toFixed(1)}%</span>
          </Box>
        </Box>
      );
    }
);

SkillsTableSection.displayName = "SkillsTableSection";
