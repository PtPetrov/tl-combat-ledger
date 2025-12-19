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
	  selectedSessionId != null ? `Pull # ${selectedSessionId}` : "All pulls";

  return (
    <Box
      sx={{
        borderRadius: "2px",
        px: cardPaddingX,
        py: { xs: 1.1, sm: 1.25, lg: 1.4 },
        background:
          "linear-gradient(135deg, rgba(13,18,30,0.98), rgba(5,8,20,0.95))",
        boxShadow:
          "0 18px 32px rgba(2,6,23,0.7), 0 0 0 1px rgba(15,23,42,0.9)",
        display: "flex",
        flexDirection: "column",
        gap: { xs: 0.6, md: 0.8 },
        minHeight: 0,
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.85rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(226,232,240,0.7)",
        }}
      >
        Target Overview
      </Typography>

      {showStats ? (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "2.4fr 1.4fr 1.8fr 1fr 1.2fr 1.2fr 1.2fr",
              },
              columnGap: { xs: 1.2, md: 2.2 },
              rowGap: { xs: 1, md: 0 },
              alignItems: "center",
              width: "100%",
              minWidth: { md: 760 },
            }}
          >
            <Box
              sx={{
                gridColumn: { xs: "1 / -1", md: "1 / span 4" },
                gridRow: { md: 1 },
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                minWidth: 0,
              }}
            >
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
                          width: 40,
                          height: 40,
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
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )
              )}
              <Typography
                sx={{
                  fontSize: "1.55rem",
                  fontWeight: 700,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {targetLabel}
              </Typography>
              <Box
                sx={{
                  width: "1px",
                  height: 22,
                  backgroundColor: "rgba(55,65,81,0.8)",
                  flexShrink: 0,
                }}
              />
              <Typography
                sx={{
                  fontSize: "1rem",
                  color: "rgba(226,232,240,0.7)",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {sessionLabel}
              </Typography>
            </Box>

            <Box sx={{ gridColumn: { xs: "1 / -1", md: "5" }, gridRow: { md: 1 } }}>
              <InlineStat
                label="Total Damage"
                value={formatInteger(currentTotalDamage)}
              />
            </Box>
            <Box sx={{ gridColumn: { xs: "1 / -1", md: "6" }, gridRow: { md: 1 } }}>
              <InlineStat label="DPS" value={formatNumber(currentDps)} />
            </Box>
            <Box sx={{ gridColumn: { xs: "1 / -1", md: "7" }, gridRow: { md: 1 } }}>
              <InlineStat
                label="Duration"
                value={formatDuration(currentDurationSeconds)}
              />
            </Box>
          </Box>

          {/* Intentionally hide log name in this card */}
        </>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
          Select a log and target to see stats.
        </Typography>
      )}
    </Box>
  );
};

const InlineStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <Box
    sx={{
      px: 1.2,
      py: 0.7,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 0.25,
      minWidth: 0,
    }}
  >
    <Typography
      sx={{
        fontSize: "0.78rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "rgba(224,231,255,0.72)",
        textAlign: "left",
        width: "100%",
      }}
    >
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: "1.3rem",
        fontWeight: 650,
        lineHeight: 1.1,
        color: "#e0e7ff",
        textAlign: "left",
        width: "100%",
      }}
    >
      {value}
    </Typography>
  </Box>
);
