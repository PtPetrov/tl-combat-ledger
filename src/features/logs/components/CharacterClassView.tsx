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

const skillToWeaponMap: Map<string, string> = (() => {
  const map = new Map<string, string>();

  (skillsData as SkillMeta[]).forEach((s) => {
    const baseWeapon = normalizeWeaponNameFromSkill(s.weapon);
    const weaponKey = baseWeapon;

    // Full skill name
    const fullNorm = normalize(s.name);
    if (!map.has(fullNorm)) {
      map.set(fullNorm, weaponKey);
    }

    // Trimmed skill name
    const trimmed = trimSkillNameSuffix(s.name);
    const trimmedNorm = normalize(trimmed);
    if (trimmedNorm && !map.has(trimmedNorm)) {
      map.set(trimmedNorm, weaponKey);
    }
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

  for (const skill of skills) {
    const trimmed = trimSkillNameSuffix(skill.skillName);
    const normName = normalize(trimmed);
    const weapon = skillToWeaponMap.get(normName);
    if (!weapon) continue;

    const prev = damageByWeapon.get(weapon) ?? 0;
    damageByWeapon.set(weapon, prev + skill.totalDamage);
  }

  if (damageByWeapon.size === 0) {
    return { primaryWeapons: [], detectedClass: null };
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
  /** Skills for the current scope (overall or target+session) */
  currentTopSkills: SkillBreakdown[];
}

export const CharacterClassView: React.FC<CharacterClassViewProps> = React.memo(
  ({ characterName, currentTopSkills }) => {
    const { primaryWeapons, detectedClass } =
      inferClassFromSkills(currentTopSkills);

    const displayName = characterName || "Unknown character";
    const weaponsLabel = primaryWeapons.length
      ? primaryWeapons.join(" + ")
      : "Unknown weapons";

    const classLabel = detectedClass
      ? detectedClass.className
      : "Unknown class";

    return (
      <Box
        sx={{
          borderRadius: "2px",
          px: cardPaddingX,
          py: cardPaddingY,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(5,8,20,0.95))",
          boxShadow:
            "0 18px 32px rgba(2,6,23,0.7), 0 0 0 1px rgba(15,23,42,0.9)",
          display: "flex",
          flexDirection: "column",
          gap: cardGap,
          minHeight: 0,
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.95rem",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(226,232,240,0.7)",
          }}
        >
          Character Loadout
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.6,
          }}
        >
          <Typography sx={{ fontSize: "1.85rem", fontWeight: 700 }}>
            {displayName}
          </Typography>
          <Typography
            sx={{
              fontSize: "1.2rem",
              fontWeight: 600,
              color: detectedClass ? "#6366f1" : "rgba(226,232,240,0.7)",
            }}
          >
            {classLabel}
          </Typography>
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {weaponsLabel}
          </Typography>
        </Box>
      </Box>
    );
  }
);

CharacterClassView.displayName = "CharacterClassView";
