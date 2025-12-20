// src/features/logs/components/rows/DefaultDirectoriesRow.tsx
import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import { sectionSpacing } from "../ui";

export interface DefaultDirectoriesRowProps {
  defaultDirs: string[];
  selectedDir: string | null;
  onSelectDefaultDir: (dir: string) => void;
}

export const DefaultDirectoriesRow: React.FC<DefaultDirectoriesRowProps> =
  React.memo(({ defaultDirs, selectedDir, onSelectDefaultDir }) => (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: sectionSpacing,
        rowGap: sectionSpacing,
        width: "100%",
      }}
    >
      {defaultDirs.map((dir) => (
        <Chip
          key={dir}
          label={dir}
          onClick={() => onSelectDefaultDir(dir)}
          variant={dir === selectedDir ? "filled" : "outlined"}
          sx={{
            maxWidth: "100%",
            borderRadius: 999,
            backgroundColor:
              dir === selectedDir
                ? "rgba(251,191,36,0.2)"
                : "rgba(15,23,42,0.95)",
            borderColor:
              dir === selectedDir
                ? "rgba(251,191,36,0.9)"
                : "rgba(75,85,99,0.8)",
            px: 1.5,
            height: 32,
            "& .MuiChip-label": {
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
              fontSize: "1.2rem",
            },
          }}
        />
      ))}
      {defaultDirs.length === 0 && (
        <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
          No default TL folders detected for this OS.
        </Typography>
      )}
    </Box>
  ));

DefaultDirectoriesRow.displayName = "DefaultDirectoriesRow";
