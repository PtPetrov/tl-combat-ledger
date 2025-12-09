// src/components/logs/LogsRow.tsx
import React from "react";
import { Box, CircularProgress, IconButton, Tooltip as MuiTooltip, Typography } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { LoadState, LogFileInfo } from "../types/logTypes";
import { formatShortDate, scrollBarStyles } from "../utils/logsViewUtils";

export interface LogsRowProps {
  logs: LogFileInfo[];
  state: LoadState;
  error: string | null;
  hasLogs: boolean;
  selectedLog: LogFileInfo | null;
  onSelectLog: (log: LogFileInfo) => void;
  onRefresh: () => void;
  onSelectFolder: () => void;
  selectedDir: string | null;
  fillHeight?: boolean;
}

export const LogsRow: React.FC<LogsRowProps> = React.memo(
  ({
    logs,
    state,
    error,
    hasLogs,
    selectedLog,
    onSelectLog,
    onRefresh,
    onSelectFolder,
    selectedDir,
    fillHeight = false,
  }) => {
    const containerStyles = fillHeight
      ? {
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          height: "100%",
        }
      : {};

    const refreshDisabled = !selectedDir || state === "loading";
    const browseDisabled = state === "loading";

    return (
      <Box sx={containerStyles}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon sx={{ fontSize: "1.2rem", color: "text.secondary" }} />
            <Typography
              sx={{
                fontSize: "0.9rem",
                color: "text.secondary",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                lineHeight: 1,
              }}
            >
              Logs
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                fontSize: "0.8rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              ({logs.length})
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <MuiTooltip title="Refresh current folder">
              <span>
                <IconButton
                  size="small"
                  onClick={onRefresh}
                  disabled={refreshDisabled}
                  sx={{
                    width: 34,
                    height: 34,
                    color: "#a5b4fc",
                  }}
                >
                  <RefreshIcon sx={{ fontSize: "1.15rem" }} />
                </IconButton>
              </span>
            </MuiTooltip>
            <MuiTooltip title="Browse for log folder">
              <span>
                <IconButton
                  size="small"
                  onClick={onSelectFolder}
                  disabled={browseDisabled}
                  sx={{
                    width: 34,
                    height: 34,
                    color: "#a5b4fc",
                  }}
                >
                  <FolderOpenIcon sx={{ fontSize: "1.15rem" }} />
                </IconButton>
              </span>
            </MuiTooltip>
          </Box>
        </Box>

        {state === "loading" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" sx={{ fontSize: "1rem" }}>
              Scanning...
            </Typography>
          </Box>
        )}
        {error && (
          <Typography color="error" sx={{ fontSize: "1rem", mb: 1 }}>
            {error}
          </Typography>
        )}

        <Box
          sx={{
            ...scrollBarStyles,
            overflowY: "auto",
            pr: 0.5,
            flex: fillHeight ? 1 : undefined,
            minHeight: fillHeight ? 0 : undefined,
            maxHeight: "calc(6 * 3.3rem)",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 1,
            }}
          >
            {hasLogs ? (
              logs.map((log) => {
                const isActive = selectedLog?.path === log.path;
                return (
                  <Box
                    key={log.path}
                    onClick={() => onSelectLog(log)}
                    sx={{
                      px: 1.6,
                      py: 0.65,
                      borderRadius: 0,
                      cursor: "pointer",
                      backgroundColor: isActive
                        ? "rgba(99,102,241,0.18)"
                        : "rgba(15,23,42,0.96)",
                      "&:hover": {
                        backgroundColor: "rgba(99,102,241,0.12)",
                      },
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 0.8,
                      minWidth: 0,
                      color: isActive ? "#e0e7ff" : "inherit",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: "0.9rem",
                        }}
                      >
                        {log.name}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.secondary",
                        }}
                      >
                        {formatShortDate(log.modifiedAt)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
                No log files found in the selected folder.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  }
);

LogsRow.displayName = "LogsRow";
