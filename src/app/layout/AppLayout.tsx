// src/components/layout/AppLayout.tsx
import React from "react";
import { Box, useTheme } from "@mui/material";
import TopBar from "./TopBar";

type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: "100vw",
        height: "auto",
        display: "flex",
        flexDirection: "column",
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        overflow: "hidden", // no global scrollbars
      }}
    >
      <TopBar />

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          px: 2,
          pb: 2,
          pt: 1.5,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AppLayout;
