// src/layout/TopBar.tsx
import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Minimize";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import CloseIcon from "@mui/icons-material/Close";

type WindowControlsApi = {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
};

const getWindowApi = (): WindowControlsApi | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as any)?.tlcla?.window as WindowControlsApi | undefined;
};

const TopBar: React.FC = () => {
  const windowApiRef = React.useRef<WindowControlsApi | undefined>();

  React.useEffect(() => {
    windowApiRef.current = getWindowApi();
  }, []);

  const handleMinimize = () => windowApiRef.current?.minimize();
  const handleToggleMaximize = () => windowApiRef.current?.toggleMaximize();
  const handleClose = () => windowApiRef.current?.close();

  return (
    <Box
      sx={{
        height: 44,
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, #020617, #111827, #020617)",
        borderBottom: "1px solid rgba(55,65,81,0.9)",
        WebkitAppRegion: "drag",
        flexShrink: 0,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#9ca3af",
          fontSize: "0.85rem",
        }}
      >
        TL Combat Ledger – TL Combat Log Analyzer
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          WebkitAppRegion: "no-drag",
        }}
      >
        <IconButton
          size="medium"
          onClick={handleMinimize}
          sx={{ width: 32, height: 32, "& svg": { fontSize: 16 } }}
        >
          <MinimizeIcon />
        </IconButton>
        <IconButton
          size="medium"
          onClick={handleToggleMaximize}
          sx={{ width: 32, height: 32, "& svg": { fontSize: 16 } }}
        >
          <CropSquareIcon />
        </IconButton>
        <IconButton
          size="medium"
          onClick={handleClose}
          sx={{
            width: 32,
            height: 32,
            "&:hover": { backgroundColor: "#b91c1c" },
            "& svg": { fontSize: 16 },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default TopBar;
