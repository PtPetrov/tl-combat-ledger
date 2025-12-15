import React from "react";
import { Box, Typography } from "@mui/material";
import { TelemetryControl } from "./TelemetryControl";

const FooterBar: React.FC = () => {
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
      <Box sx={{ width: 34 }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 500,
          letterSpacing: "0.16em",
          color: "#9ca3af",
          fontSize: "0.85rem",
          textAlign: "center",
          flex: 1,
        }}
      >
        Made by nOtDeviL
      </Typography>
      <TelemetryControl />
    </Box>
  );
};

export default FooterBar;
