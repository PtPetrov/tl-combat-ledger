// src/components/logs/CharacterClassView.tsx
import React from "react";
import { Box, Typography } from "@mui/material";
import { SkillBreakdown } from "../types/logTypes";
import skillsData from "../../../assets/skills.json";
import classesData from "../../../assets/classess.json";
import { cardGap, cardPaddingX, cardPaddingY } from "./layoutTokens";

/**
 * JSON shapes
 */
interface SkillMeta {
  weapon: string;
  weaponSlug: string;
  name: string;
  slug: string;
  iconUrl?: string | null;
  iconPath?: string | null;
}

interface ClassWeaponMeta {
  name: string;
  slug: string;
}

interface CharacterClassMeta {
  className: string;
  classSlug: string;
  weapons: ClassWeaponMeta[];
}

/* ------------------------------------------------------------------ */
/* Normalization helpers                                              */
/* ------------------------------------------------------------------ */

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Some skill names in logs may have suffixes like "Active", "Common", etc.
 * Trim these so we can match against skills.json more reliably.
 */
const trimSkillNameSuffix = (name: string): string => {
  const cutMarkers = [" Active", " Common", " Weapon Mastery"];
  for (const marker of cutMarkers) {
    const idx = name.indexOf(marker);
    if (idx > 0) {
      return name.slice(0, idx);
    }
  }
  return name;
};

/**
 * Map "Sword & Shield" (and similar) from skills.json to a base weapon
 * that appears in the classes list (e.g. "Sword").
 */
const normalizeWeaponNameFromSkill = (weapon: string): string => {
  const lower = weapon.toLowerCase();

  if (lower.includes("sword") && lower.includes("shield")) {
    return "Sword";
  }

  return weapon;
};

/**
 * Normalize a weapon name for comparison (case-insensitive, strip spaces).
 */
const normalizeWeaponKey = (weapon: string): string => normalize(weapon);

/* ------------------------------------------------------------------ */
/* Build lookup tables from JSON                                      */
/* ------------------------------------------------------------------ */

const skillToWeaponsMap: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();

  (skillsData as SkillMeta[]).forEach((s) => {
    const baseWeapon = normalizeWeaponNameFromSkill(s.weapon);
    const weaponKey = baseWeapon;

    const addMapping = (key: string) => {
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        existing.add(weaponKey);
      } else {
        map.set(key, new Set([weaponKey]));
      }
    };

    // Full skill name
    const fullNorm = normalize(s.name);
    addMapping(fullNorm);

    // Trimmed skill name
    const trimmed = trimSkillNameSuffix(s.name);
    const trimmedNorm = normalize(trimmed);
    addMapping(trimmedNorm);
  });

  return map;
})();

/**
 * Map from a sorted weapon pair key "sword|greatsword" → class meta.
 */
const classByWeaponPairKey: Map<string, CharacterClassMeta> = (() => {
  const map = new Map<string, CharacterClassMeta>();

  (classesData as CharacterClassMeta[]).forEach((cls) => {
    if (!cls.weapons || cls.weapons.length !== 2) return;

    const w1 = normalizeWeaponKey(cls.weapons[0].name);
    const w2 = normalizeWeaponKey(cls.weapons[1].name);
    const key = w1 < w2 ? `${w1}|${w2}` : `${w2}|${w1}`;

    if (!map.has(key)) {
      map.set(key, cls);
    }
  });

  return map;
})();

/* ------------------------------------------------------------------ */
/* Utility: infer weapons & class from skills                         */
/* ------------------------------------------------------------------ */

interface InferredClassInfo {
  primaryWeapons: string[]; // normalized display names
  detectedClass: CharacterClassMeta | null;
}

/**
 * Given the current skills (with totalDamage), find the two most
 * significant weapons and match them to a class in classes.json.
 */
const inferClassFromSkills = (skills: SkillBreakdown[]): InferredClassInfo => {
  if (!skills.length) {
    return { primaryWeapons: [], detectedClass: null };
  }

  // Aggregate damage by weapon
  const damageByWeapon = new Map<string, number>();
  const ambiguousSkills: Array<{ candidates: string[]; damage: number }> = [];

  for (const skill of skills) {
    const trimmed = trimSkillNameSuffix(skill.skillName);
    const normName = normalize(trimmed);
    const weapons = skillToWeaponsMap.get(normName);
    if (!weapons || weapons.size === 0) continue;

    if (weapons.size === 1) {
      const weapon = Array.from(weapons)[0];
      const prev = damageByWeapon.get(weapon) ?? 0;
      damageByWeapon.set(weapon, prev + skill.totalDamage);
    } else {
      ambiguousSkills.push({
        candidates: Array.from(weapons),
        damage: skill.totalDamage,
      });
    }
  }

  if (damageByWeapon.size === 0) {
    return { primaryWeapons: [], detectedClass: null };
  }

  // Resolve ambiguous skills (e.g. "Basic Shot") by assigning them to weapons
  // already supported by unambiguous skills; otherwise distribute evenly.
  if (ambiguousSkills.length) {
    for (const amb of ambiguousSkills) {
      const supportedCandidates = amb.candidates.filter((w) =>
        damageByWeapon.has(w)
      );

      if (supportedCandidates.length) {
        const best = supportedCandidates.reduce((bestWeapon, current) => {
          const bestScore = damageByWeapon.get(bestWeapon) ?? 0;
          const currentScore = damageByWeapon.get(current) ?? 0;
          return currentScore > bestScore ? current : bestWeapon;
        }, supportedCandidates[0]);

        damageByWeapon.set(best, (damageByWeapon.get(best) ?? 0) + amb.damage);
        continue;
      }

      const share =
        amb.candidates.length > 0 ? amb.damage / amb.candidates.length : 0;
      for (const weapon of amb.candidates) {
        damageByWeapon.set(
          weapon,
          (damageByWeapon.get(weapon) ?? 0) + share
        );
      }
    }
  }

  // Sort weapons by total damage desc
  const sortedWeapons = Array.from(damageByWeapon.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([weapon]) => weapon);

  const primaryWeapons = sortedWeapons.slice(0, 2);

  if (primaryWeapons.length < 2) {
    return { primaryWeapons, detectedClass: null };
  }

  // Find matching class
  const [wA, wB] = primaryWeapons;
  const key = (() => {
    const k1 = normalizeWeaponKey(wA);
    const k2 = normalizeWeaponKey(wB);
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  })();

  const detectedClass = classByWeaponPairKey.get(key) ?? null;

  return { primaryWeapons, detectedClass };
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface CharacterClassViewProps {
  /** Player / character name extracted from the combat log */
  characterName: string | null;
  /** Skills for the current scope (overall or target+pull) */
  currentTopSkills: SkillBreakdown[];
  variant?: "main" | "sidebar";
}

export const CharacterClassView: React.FC<CharacterClassViewProps> = React.memo(
  ({ characterName, currentTopSkills, variant = "main" }) => {
    const { primaryWeapons, detectedClass } =
      inferClassFromSkills(currentTopSkills);

    const displayName = characterName || "Unknown character";
    const weaponsLabel =
      primaryWeapons.length === 1
        ? "Please, make sure you use both your weapon skills in order to determen the class and the weapons"
        : primaryWeapons.length
          ? primaryWeapons.join(" | ")
          : "Unknown weapons";

    const classLabel = detectedClass
      ? detectedClass.className
      : "Unknown class";

    const isSidebar = variant === "sidebar";

    return (
      <Box
        sx={{
          borderRadius: "2px",
          px: isSidebar ? 1 : cardPaddingX,
          py: isSidebar ? 1 : cardPaddingY,
          background: isSidebar
            ? "rgba(10,16,28,0.9)"
            : "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(5,8,20,0.95))",
          border: isSidebar ? "1px solid rgba(30,41,59,0.6)" : undefined,
          boxShadow: isSidebar
            ? "none"
            : "0 18px 32px rgba(2,6,23,0.7), 0 0 0 1px rgba(15,23,42,0.9)",
          display: "flex",
          flexDirection: "column",
          gap: isSidebar ? 0.9 : cardGap,
          minHeight: 0,
          justifyContent: isSidebar ? "flex-start" : "center",
          alignItems: "flex-start",
        }}
      >
        {isSidebar ? (
          <Typography
            sx={{
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "text.secondary",
              fontSize: "0.9rem",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
              mb: 0.8,
            }}
          >
            Character
          </Typography>
        ) : (
          <Typography
            sx={{
              fontSize: "0.95rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "rgba(226,232,240,0.7)",
            }}
          >
            Character
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.6,
          }}
        >
          <Typography
            sx={{
              fontSize: isSidebar ? "1.3rem" : "1.85rem",
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {displayName}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 1.2,
              width: "100%",
              minWidth: 0,
            }}
          >
            <Typography
              sx={{
                fontSize: isSidebar ? "0.95rem" : "1.1rem",
                fontWeight: 500,
                color: "#e5e7eb",
                flexShrink: 0,
              }}
            >
              {classLabel}
            </Typography>
            <Typography
              sx={{
                fontSize: isSidebar ? "0.95rem" : "1.1rem",
                fontWeight: 500,
                color: "rgba(226,232,240,0.72)",
                flex: "0 1 auto",
                flexShrink: 1,
                minWidth: 0,
                textAlign: "right",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={weaponsLabel}
            >
              {weaponsLabel}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }
);

CharacterClassView.displayName = "CharacterClassView";
