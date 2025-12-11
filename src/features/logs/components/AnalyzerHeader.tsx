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
  defaultDirs?: string[];
  selectedDir?: string | null;
  onSelectDefaultDir?: (dir: string) => void;
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
    defaultDirs = [],
    selectedDir = null,
    onSelectDefaultDir,
    updateStatus,
    onCheckForUpdates,
    onInstallUpdate,
  }) => {
    const renderUpdateControl = () => {
      if (!onCheckForUpdates && !onInstallUpdate) {
        return null;
      }

      const status = updateStatus;
      const devDisabled =
        status?.state === "error" &&
        status?.message?.toLowerCase?.().includes("development");

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

      if (devDisabled) {
        return (
          <Button variant="outlined" disabled sx={{ textTransform: "none" }}>
            Updates unavailable in dev
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

    const renderDefaultDirButtons = () => {
      if (!defaultDirs?.length) return null;

      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            rowGap: 1,
            minWidth: 0,
          }}
        >
          {defaultDirs.map((dir) => {
            const isSelected = dir === selectedDir;
            return (
              <Box
                key={dir}
                component="button"
                type="button"
                onClick={() => onSelectDefaultDir?.(dir)}
                sx={{
                  maxWidth: "100%",
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: isSelected
                    ? "rgba(99,102,241,0.8)"
                    : "rgba(71,85,105,0.8)",
                  background: isSelected
                    ? "linear-gradient(120deg, rgba(99,102,241,0.12), rgba(129,140,248,0.12))"
                    : "rgba(15,23,42,0.75)",
                  boxShadow: isSelected
                    ? "0 0 0 1px rgba(129,140,248,0.3), 0 10px 30px rgba(15,23,42,0.9)"
                    : "0 0 0 1px rgba(15,23,42,0.8)",
                  color: isSelected ? "#e0e7ff" : "#cbd5e1",
                  px: { xs: 1.6, md: 1.8 },
                  py: 0.9,
                  fontSize: { xs: "0.9rem", md: "0.95rem" },
                  letterSpacing: "0.01em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.6,
                  transition: "all 140ms ease",
                  backdropFilter: "blur(6px)",
                  "&:hover": {
                    borderColor: "rgba(129,140,248,0.9)",
                    color: "#e2e8f0",
                    background: "rgba(79,70,229,0.14)",
                  },
                  "&:active": {
                    transform: "translateY(1px)",
                  },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    maxWidth: "100%",
                    whiteSpace: "normal",
                    wordBreak: "break-all",
                    textAlign: "left",
                  }}
                >
                  {dir}
                </Box>
              </Box>
            );
          })}
        </Box>
      );
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
          alt="TL Combat Ledger logo"
          sx={{ width: 90, height: 90, borderRadius: 0.75 }}
        />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.175,
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
            TL Combat Ledger
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
          gap: 1.1,
          flexWrap: "wrap",
          justifyContent: { xs: "flex-start", md: "flex-end" },
          alignSelf: { xs: "flex-end", md: "center" },
          maxWidth: "100%",
        }}
      >
        {renderDefaultDirButtons()}
        {renderUpdateControl()}
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
    );
  }
);

AnalyzerHeader.displayName = "AnalyzerHeader";
