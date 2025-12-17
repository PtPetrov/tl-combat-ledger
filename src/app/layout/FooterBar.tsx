import React from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import { TelemetryControl } from "./TelemetryControl";
import { useReleaseNotes } from "./ReleaseNotesProvider";

const FooterBar: React.FC = () => {
  const footerText = "Made for the Throne & Liberty community by nOtDeviL";
  const { openReleaseNotes } = useReleaseNotes();

  return (
    <Box
      sx={{
        height: 44,
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, #020617, #111827, #020617)",
        borderTop: "1px solid rgba(55,65,81,0.9)",
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          noWrap
          title={footerText}
          sx={{
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: "#9ca3af",
            fontSize: "0.8rem",
            minWidth: 0,
          }}
        >
          {footerText}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
        <Tooltip
          title="Release notes"
          placement="top"
          enterDelay={250}
        >
          <IconButton
            aria-label="Release notes"
            onClick={openReleaseNotes}
            sx={{
              width: 34,
              height: 34,
              color: "rgba(226,232,240,0.9)",
              "&:hover": { color: "#c7d2fe" },
            }}
          >
            <StickyNote2OutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <TelemetryControl />
      </Box>
    </Box>
  );
};

export default FooterBar;
