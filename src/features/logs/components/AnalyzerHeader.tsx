// src/components/logs/AnalyzerHeader.tsx
import React from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import CompareIcon from "@mui/icons-material/Compare";

export interface AnalyzerHeaderProps {
  onToggleCompare?: () => void;
  isCompareActive?: boolean;
  showCompareControl?: boolean;
  contextLabel?: string;
}

export const AnalyzerHeader: React.FC<AnalyzerHeaderProps> = React.memo(
  ({
    onToggleCompare,
    isCompareActive,
    showCompareControl = true,
    contextLabel,
  }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        flexWrap: { xs: "wrap", md: "nowrap" },
        justifyContent: "space-between",
        rowGap: 1.2,
        mb: 0,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: { xs: 1, md: 1.2 },
          alignItems: "center",
        }}
      >
        <Box
          component="img"
          src="/src/assets/images/logo.png"
          alt="Fabolyzer logo"
          sx={{ width: 90, height: 90, borderRadius: 0.75 }}
        />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.35,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 0.4, md: 0.6 },
              flexWrap: "wrap",
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#4f46e5",
                fontSize: "1.8rem",
              }}
            >
              Fabolyzer
            </Typography>
            {contextLabel && (
              <Typography
                component="span"
                sx={{
                  fontSize: "1rem",
                  fontWeight: 500,
                  color: "text.secondary",
                  letterSpacing: 0,
                  ml: 0.6,
                }}
              >
                {contextLabel}
              </Typography>
            )}
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
            Select a log, then a target and session to inspect each rotation.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          alignSelf: { xs: "flex-end", md: "center" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {showCompareControl && onToggleCompare && (
            <Tooltip title="Compare logs" placement="bottom">
              <IconButton
                aria-label="Compare logs"
                onClick={onToggleCompare}
                sx={{
                  color: isCompareActive ? "#a5b4fc" : "rgba(226,232,240,0.9)",
                  transition: "color 150ms ease",
                  "&:hover": { color: "#c7d2fe" },
                }}
              >
                <CompareIcon sx={{ fontSize: "1.7rem" }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  )
);

AnalyzerHeader.displayName = "AnalyzerHeader";
