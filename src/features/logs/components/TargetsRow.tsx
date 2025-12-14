// src/components/logs/TargetsRow.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, FormControl, MenuItem, Select, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { LoadState, TargetBreakdown } from "../types/logTypes";
import { scrollBarStyles } from "../utils/logsViewUtils";
import {
  getTargetCategoryKey,
  getTargetIconPath,
  TargetCategoryKey,
  TARGET_CATEGORY_LABELS,
} from "../utils/targetIcons";

type TargetCategoryFilter = "all" | TargetCategoryKey;

const TARGET_ROW_HEIGHT_PX = 64;
const TARGET_VIRTUALIZE_THRESHOLD = 80;
const TARGET_VIRTUALIZE_OVERSCAN = 8;

export interface TargetsRowProps {
  summaryState: LoadState;
  topTargets: TargetBreakdown[];
  overallTotalDamage: number;
  selectedTargetName: string | null;
  onSelectTarget: (targetName: string | null) => void;
  fillHeight?: boolean;
}

export const TargetsRow: React.FC<TargetsRowProps> = React.memo(
  ({
    summaryState,
    topTargets,
    overallTotalDamage, // reserved for future use
    selectedTargetName,
    onSelectTarget,
    fillHeight = false,
  }) => {
    const showTargets = summaryState === "loaded" && topTargets.length > 0;
    const TARGET_VIEWPORT_ROWS = 15;

    const [selectedCategory, setSelectedCategory] =
      useState<TargetCategoryFilter>("all");

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);

    const filteredTargets = useMemo(() => {
      if (selectedCategory === "all") return topTargets;
      return topTargets.filter(
        (t) => getTargetCategoryKey(t.targetName) === selectedCategory
      );
    }, [selectedCategory, topTargets]);

    const shouldVirtualize = filteredTargets.length >= TARGET_VIRTUALIZE_THRESHOLD;

    useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;

      const update = () => setViewportHeight(el.clientHeight);
      update();

      const observer = new ResizeObserver(update);
      observer.observe(el);

      return () => observer.disconnect();
    }, []);

    const { renderTargets, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
      if (!shouldVirtualize) {
        return {
          renderTargets: filteredTargets,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
        };
      }

      const total = filteredTargets.length;
      const visibleCount = Math.ceil(viewportHeight / TARGET_ROW_HEIGHT_PX);
      const startIndex = Math.floor(scrollTop / TARGET_ROW_HEIGHT_PX);
      const from = Math.max(0, startIndex - TARGET_VIRTUALIZE_OVERSCAN);
      const to = Math.min(
        total,
        startIndex + visibleCount + TARGET_VIRTUALIZE_OVERSCAN
      );

      return {
        renderTargets: filteredTargets.slice(from, to),
        topSpacerHeight: from * TARGET_ROW_HEIGHT_PX,
        bottomSpacerHeight: (total - to) * TARGET_ROW_HEIGHT_PX,
      };
    }, [filteredTargets, scrollTop, viewportHeight, shouldVirtualize]);

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          height: fillHeight ? "100%" : undefined,
          minHeight: fillHeight ? 0 : undefined,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 0.8,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
            <PersonIcon sx={{ fontSize: "1.2rem", color: "text.secondary" }} />
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
              }}
            >
              Targets
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={selectedCategory}
              onChange={(e) => {
                const nextCategory = e.target.value as TargetCategoryFilter;
                setSelectedCategory(nextCategory);
                if (nextCategory === "all") {
                  onSelectTarget(null);
                }
              }}
              sx={{
                borderRadius: 0,
                backgroundColor: "rgba(15,23,42,0.96)",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(42,53,79,0.9)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(99,102,241,0.6)",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(99,102,241,0.85)",
                },
                "& .MuiSelect-select": {
                  py: 0.55,
                  fontSize: "0.9rem",
                },
              }}
            >
              <MenuItem value="all">All targets</MenuItem>
              <MenuItem value="boss">{TARGET_CATEGORY_LABELS.boss}</MenuItem>
              <MenuItem value="arch-boss">
                {TARGET_CATEGORY_LABELS["arch-boss"]}
              </MenuItem>
              <MenuItem value="mobs">{TARGET_CATEGORY_LABELS.mobs}</MenuItem>
              <MenuItem value="dummy">{TARGET_CATEGORY_LABELS.dummy}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {!showTargets ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              color: "text.secondary",
              fontSize: "1rem",
            }}
          >
            Per-target breakdown will appear here after parsing a log.
          </Box>
        ) : (
          <Box
            sx={{
              overflowY: "auto",
              pr: 0.5,
              ...scrollBarStyles,
              flex: fillHeight ? 1 : undefined,
              minHeight: fillHeight ? 0 : undefined,
              maxHeight: fillHeight
                ? undefined
                : `calc(${TARGET_VIEWPORT_ROWS} * 3.3rem)`,
            }}
            ref={scrollContainerRef}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.6,
              }}
            >
              {filteredTargets.length === 0 ? (
                <Box
                  sx={{
                    px: 1.6,
                    py: 1.2,
                    color: "text.secondary",
                    fontSize: "0.95rem",
                  }}
                >
                  No targets found for this category.
                </Box>
              ) : (
                <>
                  {shouldVirtualize && topSpacerHeight > 0 && (
                    <Box sx={{ height: `${topSpacerHeight}px` }} />
                  )}

                  {renderTargets.map((t) => {
                  const isSelected = t.targetName === selectedTargetName;
                  const iconPath = getTargetIconPath(t.targetName);
                  return (
                    <Box
                      component="button"
                      type="button"
                      key={t.targetName}
                      onClick={() => onSelectTarget(t.targetName)}
                      sx={{
                        border: "none",
                        width: "100%",
                        minWidth: 0,
                        textAlign: "left",
                        px: 1.6,
                        py: 0.75,
                        minHeight: "3.3rem",
                        height: `${TARGET_ROW_HEIGHT_PX}px`,
                        cursor: "pointer",
                        backgroundColor: isSelected
                          ? "rgba(99,102,241,0.18)"
                          : "rgba(15,23,42,0.96)",
                        "&:hover": {
                          backgroundColor: "rgba(99,102,241,0.12)",
                        },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        borderRadius: 0,
                        color: isSelected ? "#e0e7ff" : "inherit",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {iconPath && (
                          <Box
                            component="img"
                            src={iconPath}
                            alt={t.targetName}
                            sx={{
                              width: 52,
                              height: 52,
                              borderRadius: 0,
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <Typography
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            textAlign: "left",
                            minWidth: 0,
                          flex: 1,
                          lineHeight: 1.2,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {t.targetName}
                      </Typography>
                    </Box>
                  </Box>
                );
                })}

                  {shouldVirtualize && bottomSpacerHeight > 0 && (
                    <Box sx={{ height: `${bottomSpacerHeight}px` }} />
                  )}
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  }
);

TargetsRow.displayName = "TargetsRow";
