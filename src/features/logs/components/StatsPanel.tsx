import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { LoadState } from "../types/logTypes";
import {
  formatDuration,
  formatInteger,
  formatNumber,
} from "../utils/formatters";
import { getTargetIconPath, TARGET_PLACEHOLDER_ICON_PATH } from "../utils/targetIcons";
import {
  cardGap,
  cardPaddingX,
  cardPaddingY,
} from "./layoutTokens";

export interface StatsPanelProps {
  summaryState: LoadState;
  selectedSummaryTitle: string;
  currentTotalDamage: number;
  currentDps: number | null;
  currentDurationSeconds: number | null;
  selectedTargetName: string | null;
  selectedSessionId: number | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  summaryState,
  selectedSummaryTitle,
  currentTotalDamage,
  currentDps,
  currentDurationSeconds,
  selectedTargetName,
  selectedSessionId,
}) => {
  const showStats = summaryState === "loaded";
  const targetLabel = selectedTargetName ?? "All targets";
  const targetIconPath = selectedTargetName
    ? getTargetIconPath(selectedTargetName)
    : undefined;
  const isPlaceholderIcon =
    Boolean(targetIconPath) && targetIconPath === TARGET_PLACEHOLDER_ICON_PATH;
  const sessionLabel =
    selectedSessionId != null ? `Pull ${selectedSessionId}` : "All pulls";

  return (
    <Box
      sx={{
        borderRadius: "2px",
        px: cardPaddingX,
        py: cardPaddingY,
        background:
          "linear-gradient(135deg, rgba(13,18,30,0.98), rgba(5,8,20,0.95))",
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
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(226,232,240,0.7)",
        }}
      >
        Target Overview
      </Typography>

      {showStats ? (
        <>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              {targetIconPath && (
                isPlaceholderIcon ? (
                  <Tooltip
                    title="The correct target image coming soon"
                    arrow
                    placement="top"
                  >
                    <Box component="span" sx={{ display: "inline-flex" }}>
                      <Box
                        component="img"
                        src={targetIconPath}
                        alt={targetLabel}
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: 1,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    </Box>
                  </Tooltip>
                ) : (
                  <Box
                    component="img"
                    src={targetIconPath}
                    alt={targetLabel}
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: 1,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )
              )}
              <Typography sx={{ fontSize: "1.8rem", fontWeight: 700 }}>
                {targetLabel}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: "1rem",
                color: "#6366f1",
                mt: 0.4,
              }}
            >
              {sessionLabel}
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1,
            }}
          >
            <StatTile label="Total Damage" value={formatInteger(currentTotalDamage)} />
            <StatTile label="DPS" value={formatNumber(currentDps)} />
            <StatTile
              label="Duration"
              value={formatDuration(currentDurationSeconds)}
            />
          </Box>

          {selectedSummaryTitle && (
            <Typography
              sx={{
                fontSize: "0.9rem",
                color: "rgba(226,232,240,0.7)",
                letterSpacing: "0.08em",
              }}
            >
              {selectedSummaryTitle}
            </Typography>
          )}
        </>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
          Select a log and target to see stats.
        </Typography>
      )}
    </Box>
  );
};

const StatTile = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <Box
    sx={{
      borderRadius: "2px",
      border: "1px solid rgba(42,53,79,0.9)",
      backgroundColor: "rgba(9,14,26,0.9)",
      px: 1.5,
      py: 1,
      display: "flex",
      flexDirection: "column",
      gap: 0.4,
    }}
  >
    <Typography
      sx={{
        fontSize: "0.8rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "rgba(226,232,240,0.6)",
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontSize: "1.4rem", fontWeight: 600 }}>{value}</Typography>
  </Box>
);
