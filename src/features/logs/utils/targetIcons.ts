import archBossesData from "../../../assets/archBosses.json";
import bossesData from "../../../assets/bosses.json";
import mobsData from "../../../assets/mobs.json";
import placeholderLogo from "../../../../resources/logo.png?inline";

const iconAssets = import.meta.glob<string>(
  "../../../assets/icons/{bosses,arch-bosses,mobs}/**/*",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
) as Record<string, string>;

interface NamedImageMeta {
  name: string;
  image: string | null;
  category?: string;
}

export type TargetCategoryKey = "boss" | "arch-boss" | "mobs" | "dummy";

export const TARGET_CATEGORY_LABELS: Record<TargetCategoryKey, string> = {
  boss: "Boss",
  "arch-boss": "Arch Boss",
  mobs: "Mobs",
  dummy: "Dummy",
};

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "");

const getBaseTargetName = (name: string) =>
  name.replace(/\s*[\(\[].*?[\)\]]\s*$/, "").trim();

const getDummyCategoryKey = (targetName: string): TargetCategoryKey | undefined => {
  const base = getBaseTargetName(targetName);
  const baseNorm = normalizeName(base);
  if (baseNorm.includes("practicedummy")) return "dummy";
  if (baseNorm.includes("trainingdummy")) return "dummy";
  return undefined;
};

const resolveIconAssetUrl = (rawPath: string): string | undefined => {
  let cleaned = rawPath.replace(/^src\//, "");

  if (!cleaned.startsWith("assets/")) {
    if (cleaned.startsWith("icons/") || cleaned.startsWith("images/")) {
      cleaned = `assets/${cleaned}`;
    }
  }

  const assetKey = `../../../${cleaned}`;
  return iconAssets[assetKey];
};

const targetMetaMap = (() => {
  const map = new Map<
    string,
    { iconPath?: string; category?: TargetCategoryKey }
  >();

  const addEntries = (entries: NamedImageMeta[]) => {
    entries.forEach((entry) => {
      const norm = normalizeName(entry.name);
      if (!norm) return;

      const current = map.get(norm) ?? {};

      const category =
        entry.category && entry.category in TARGET_CATEGORY_LABELS
          ? (entry.category as TargetCategoryKey)
          : undefined;
      if (!current.category && category) {
        current.category = category;
      }

      if (!current.iconPath && entry.image) {
        const assetUrl = resolveIconAssetUrl(entry.image);
        if (assetUrl) {
          current.iconPath = assetUrl;
        }
      }

      map.set(norm, current);
    });
  };

  addEntries(archBossesData as NamedImageMeta[]);
  addEntries(bossesData as NamedImageMeta[]);
  addEntries(mobsData as NamedImageMeta[]);

  return map;
})();

export const getTargetIconPath = (targetName: string): string => {
  const norm = normalizeName(targetName);
  return (
    targetMetaMap.get(norm)?.iconPath ??
    targetMetaMap.get(normalizeName(getBaseTargetName(targetName)))?.iconPath
  ) ?? placeholderLogo;
};

export const getTargetCategoryKey = (
  targetName: string
): TargetCategoryKey | undefined => {
  const dummyKey = getDummyCategoryKey(targetName);
  if (dummyKey) return dummyKey;

  const norm = normalizeName(targetName);
  return (
    targetMetaMap.get(norm)?.category ??
    targetMetaMap.get(normalizeName(getBaseTargetName(targetName)))?.category
  );
};
