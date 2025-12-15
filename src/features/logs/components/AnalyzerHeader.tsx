// src/components/logs/AnalyzerHeader.tsx
import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CompareIcon from "@mui/icons-material/Compare";
import IosShareIcon from "@mui/icons-material/IosShare";
// Inline the logo to avoid any file-path issues in packaged builds.
import logoImage from "../../../../resources/logo.png?inline";
import type { UpdateStatusPayload } from "../types/updateTypes";
import { trackUsage } from "../../../telemetry/telemetry";

export interface AnalyzerHeaderProps {
  onToggleCompare?: () => void;
  isCompareActive?: boolean;
  showCompareControl?: boolean;
  contextLabel?: string;
  updateStatus?: UpdateStatusPayload | null;
  onCheckForUpdates?: () => void;
  onInstallUpdate?: () => void;
  exportFileBaseName?: string;
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
    exportFileBaseName,
  }) => {
    const [logoHidden, setLogoHidden] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const exportApi =
      typeof window !== "undefined" ? window.tlcla?.export : undefined;
    const hasExportBridge = Boolean(exportApi);

    const handleExport = async () => {
      if (!exportApi) return;
      setIsExporting(true);

      try {
        trackUsage("export.png");
        await exportApi.savePng(exportFileBaseName);
      } catch (error) {
        console.warn("Export failed", error);
      } finally {
        setIsExporting(false);
      }
    };

    const renderUpdateControl = () => {
      const status = updateStatus;
      const devDisabled =
        status?.state === "error" &&
        status?.message?.toLowerCase?.().includes("development");

      // Only render when an update is available/downloading/ready.
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

      if (status?.state === "available") {
        return (
          <Button variant="outlined" disabled sx={{ textTransform: "none" }}>
            Update available…
          </Button>
        );
      }

      // Hide the button in all other states (idle/checking/error/dev).
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
            alt="TL Combat Ledger logo"
            onError={() => setLogoHidden(true)}
            sx={{
              width: 90,
              height: 90,
              borderRadius: 0.75,
              display: logoHidden ? "none" : "block",
            }}
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

          <Tooltip
            title={
              hasExportBridge ? (isExporting ? "Exporting…" : "Export as PNG") : "Export available only in the app"
            }
            placement="bottom"
          >
            <span>
              <IconButton
                aria-label="Export as PNG"
                onClick={handleExport}
                disabled={!hasExportBridge || isExporting}
                sx={{
                  color: "rgba(226,232,240,0.9)",
                  transition: "color 150ms ease",
                  "&:hover": { color: "#c7d2fe" },
                }}
              >
                <IosShareIcon sx={{ fontSize: "1.65rem" }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    );
  }
);

AnalyzerHeader.displayName = "AnalyzerHeader";
