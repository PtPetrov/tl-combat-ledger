// src/components/logs/TargetsRow.tsx
import React from "react";
import { Box, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { LoadState, TargetBreakdown } from "../types/logTypes";
import { scrollBarStyles } from "../utils/logsViewUtils";

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
            <PersonIcon
              sx={{ fontSize: "1.2rem", color: "text.secondary" }}
            />
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
          <Box
            component="button"
            type="button"
            onClick={() => onSelectTarget(null)}
            sx={{
              border: "none",
              backgroundColor: !selectedTargetName
                ? "rgba(99,102,241,0.18)"
                : "rgba(15,23,42,0.96)",
              color: !selectedTargetName ? "#e0e7ff" : "inherit",
              cursor: "pointer",
              px: 1.6,
              py: 0.65,
              borderRadius: 0,
              minWidth: 160,
              textAlign: "center",
              "&:hover": {
                backgroundColor: "rgba(99,102,241,0.12)",
              },
            }}
          >
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "0.9rem",
                whiteSpace: "nowrap",
                textTransform: "none",
              }}
            >
              All Targets
            </Typography>
          </Box>
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
              maxHeight: `calc(${TARGET_VIEWPORT_ROWS} * 3.3rem)`,
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.6,
              }}
            >
              {topTargets.map((t) => {
                const isSelected = t.targetName === selectedTargetName;
                return (
                  <Box
                    component="button"
                    type="button"
                    key={t.targetName}
                    onClick={() => onSelectTarget(t.targetName)}
                    sx={{
                      border: "none",
                      width: "100%",
                      textAlign: "left",
                      px: 1.6,
                      py: 0.75,
                      minHeight: "3.3rem",
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
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "0.9rem",
                        width: "100%",
                        textAlign: "left",
                      }}
                    >
                      {t.targetName}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    );
  }
);

TargetsRow.displayName = "TargetsRow";
