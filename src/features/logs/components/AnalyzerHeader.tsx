// src/components/logs/AnalyzerHeader.tsx
import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
// Inline the logo to avoid any file-path issues in packaged builds.
import logoImage from "../../../../resources/logo.png?inline";
import type { UpdateStatusPayload } from "../types/updateTypes";

export interface AnalyzerHeaderProps {
  contextLabel?: string;
  updateStatus?: UpdateStatusPayload | null;
  onCheckForUpdates?: () => void;
  onInstallUpdate?: () => void;
}

export const AnalyzerHeader: React.FC<AnalyzerHeaderProps> = React.memo(
  ({
    contextLabel,
    updateStatus,
    onCheckForUpdates,
    onInstallUpdate,
  }) => {
    const [logoHidden, setLogoHidden] = useState(false);

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
              Select a log, then a target and pull to inspect each rotation.
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
        </Box>
      </Box>
    );
  }
);

AnalyzerHeader.displayName = "AnalyzerHeader";
