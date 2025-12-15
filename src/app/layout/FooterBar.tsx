import React from "react";
import { Box, Typography } from "@mui/material";
import { TelemetryControl } from "./TelemetryControl";

const FooterBar: React.FC = () => {
  const footerText = "Made for the Throne & Liberty community by nOtDeviL";

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
      <TelemetryControl />
    </Box>
  );
};

export default FooterBar;
