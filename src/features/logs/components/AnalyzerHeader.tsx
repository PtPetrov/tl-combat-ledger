// src/components/logs/AnalyzerHeader.tsx
import React from "react";
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import CompareIcon from "@mui/icons-material/Compare";
import logoImage from "@/assets/images/logo.png";
import type { UpdateStatusPayload } from "../types/updateTypes";

export interface AnalyzerHeaderProps {
  onToggleCompare?: () => void;
  isCompareActive?: boolean;
  showCompareControl?: boolean;
  contextLabel?: string;
  updateStatus?: UpdateStatusPayload | null;
  onCheckForUpdates?: () => void;
  onInstallUpdate?: () => void;
}

export const AnalyzerHeader: React.FC<AnalyzerHeaderProps> = React.memo(
  ({
    onToggleCompare,
    isCompareActive,
    showCompareControl = true,
    contextLabel,
    updateStatus,
    onCheckForUpdates,
    onInstallUpdate,
  }) => {
    const renderUpdateControl = () => {
      if (!onCheckForUpdates && !onInstallUpdate) {
        return null;
      }

      const status = updateStatus;

      if (status?.state === "ready" && onInstallUpdate) {
        return (
          <Button
            variant="contained"
            color="secondary"
            onClick={onInstallUpdate}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              letterSpacing: 0.02,
            }}
          >
            Restart to Update
          </Button>
        );
      }

      if (status?.state === "downloading") {
        const percent = Math.round(status.percent ?? 0);
        return (
          <Button
            variant="outlined"
            disabled
            startIcon={<CircularProgress size={16} />}
            sx={{ textTransform: "none" }}
          >
            Downloading… {percent}%
          </Button>
        );
      }

      if (status?.state === "checking") {
        return (
          <Button
            variant="outlined"
            disabled
            startIcon={<CircularProgress size={16} />}
            sx={{ textTransform: "none" }}
          >
            Checking updates…
          </Button>
        );
      }

      if (status?.state === "error") {
        return (
          <Button
            variant="outlined"
            color="error"
            onClick={onCheckForUpdates}
            sx={{ textTransform: "none" }}
          >
            Retry Update
          </Button>
        );
      }

      if (status?.state === "available") {
        return (
          <Button
            variant="outlined"
            disabled
            sx={{ textTransform: "none" }}
          >
            Update available…
          </Button>
        );
      }

      if (onCheckForUpdates) {
        return (
          <Button
            variant="outlined"
            onClick={onCheckForUpdates}
            sx={{ textTransform: "none" }}
          >
            Check for updates
          </Button>
        );
      }

      return null;
    };

    return (
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
          src={logoImage}
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
        {renderUpdateControl()}
      </Box>
    </Box>
    );
  }
);

AnalyzerHeader.displayName = "AnalyzerHeader";
