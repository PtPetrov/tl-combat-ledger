// src/components/logs/LogsRow.tsx
import React from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { LoadState, LogFileInfo } from "../types/logTypes";
import { formatShortDate, scrollBarStyles } from "../utils/logsViewUtils";

export interface LogsRowProps {
  logs: LogFileInfo[];
  logFavorites: Record<string, true>;
  state: LoadState;
  error: string | null;
  hasLogs: boolean;
  selectedLog: LogFileInfo | null;
  onSelectLog: (log: LogFileInfo) => void;
  onRenameLog: (log: LogFileInfo, nextName: string) => void;
  onToggleLogFavorite: (log: LogFileInfo) => void;
  onRefresh: () => void;
  onSelectFolder: () => void;
  selectedDir: string | null;
  fillHeight?: boolean;
}

export const LogsRow: React.FC<LogsRowProps> = React.memo(
  ({
    logs,
    logFavorites,
    state,
    error,
    hasLogs,
    selectedLog,
    onSelectLog,
    onRenameLog,
    onToggleLogFavorite,
    onRefresh,
    onSelectFolder,
    selectedDir,
    fillHeight = false,
  }) => {
    const [renamingPath, setRenamingPath] = React.useState<string | null>(null);
    const [renameDraft, setRenameDraft] = React.useState("");
    const renameInputRef = React.useRef<HTMLInputElement | null>(null);
    const cancelNextRenameCommitRef = React.useRef(false);
    const [showFavouritesOnly, setShowFavouritesOnly] = React.useState(false);

    React.useEffect(() => {
      if (!renamingPath) return;
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }, [renamingPath]);

    const beginRename = React.useCallback((log: LogFileInfo) => {
      cancelNextRenameCommitRef.current = false;
      setRenamingPath(log.path);
      setRenameDraft(log.name);
    }, []);

    const cancelRename = React.useCallback(() => {
      cancelNextRenameCommitRef.current = true;
      setRenamingPath(null);
      setRenameDraft("");
    }, []);

    const commitRename = React.useCallback(
      (log: LogFileInfo) => {
        onRenameLog(log, renameDraft);
        cancelNextRenameCommitRef.current = true;
        setRenamingPath(null);
        setRenameDraft("");
      },
      [onRenameLog, renameDraft]
    );

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
    const visibleLogs = showFavouritesOnly
      ? logs.filter((log) => Boolean(logFavorites[log.path]))
      : logs;
    const visibleLogsCount = visibleLogs.length;

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
              {showFavouritesOnly ? "Favourite Logs" : "Logs"}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                fontSize: "0.8rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              ({visibleLogsCount})
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {showFavouritesOnly ? (
              <MuiTooltip title="Back to all logs">
                <IconButton
                  size="small"
                  onClick={() => setShowFavouritesOnly(false)}
                  sx={{
                    width: 34,
                    height: 34,
                    color: "#a5b4fc",
                  }}
                  aria-label="Back to all logs"
                >
                  <ArrowBackIcon sx={{ fontSize: "1.15rem" }} />
                </IconButton>
              </MuiTooltip>
            ) : (
              <>
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
                <MuiTooltip title="Show favourite logs">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => setShowFavouritesOnly(true)}
                      sx={{
                        width: 34,
                        height: 34,
                        color: "#a5b4fc",
                      }}
                      aria-label="Show favourite logs"
                    >
                      <FavoriteIcon sx={{ fontSize: "1.15rem" }} />
                    </IconButton>
                  </span>
                </MuiTooltip>
              </>
            )}
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
            maxHeight: "calc(7 * 3.3rem)",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 1,
            }}
          >
            {visibleLogsCount > 0 ? (
              visibleLogs.map((log) => {
                const isActive = selectedLog?.path === log.path;
                const isRenaming = renamingPath === log.path;
                const isFavourite = Boolean(logFavorites[log.path]);
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
                        flex: 1,
                      }}
                    >
                      {isRenaming ? (
                        <InputBase
                          inputRef={renameInputRef}
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => {
                            if (cancelNextRenameCommitRef.current) {
                              cancelNextRenameCommitRef.current = false;
                              return;
                            }
                            commitRename(log);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRename(log);
                              return;
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          fullWidth
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            minWidth: 0,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: "2px",
                            border: "1px solid rgba(99,102,241,0.35)",
                            backgroundColor: "rgba(2,6,23,0.55)",
                            color: isActive ? "#e0e7ff" : "inherit",
                            "& input": {
                              padding: 0,
                              minWidth: 0,
                            },
                          }}
                          inputProps={{
                            "aria-label": "Rename log (in-app only)",
                          }}
                        />
                      ) : (
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
                      )}
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.secondary",
                        }}
                      >
                        {formatShortDate(log.modifiedAt)}
                      </Typography>
                    </Box>

                    {(isActive || isRenaming) && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.25,
                          flexShrink: 0,
                          alignSelf: "center",
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        {isRenaming ? (
                          <>
                            <MuiTooltip title="Save in-app name">
                              <IconButton
                                size="small"
                                aria-label="Save in-app name"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                }}
                                onClick={() => commitRename(log)}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  color: "#a5b4fc",
                                }}
                              >
                                <CheckIcon sx={{ fontSize: "1.05rem" }} />
                              </IconButton>
                            </MuiTooltip>
                            <MuiTooltip title="Cancel rename">
                              <IconButton
                                size="small"
                                aria-label="Cancel rename"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                }}
                                onClick={cancelRename}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  color: "text.secondary",
                                }}
                              >
                                <CloseIcon sx={{ fontSize: "1.05rem" }} />
                              </IconButton>
                            </MuiTooltip>
                            <MuiTooltip
                              title={
                                isFavourite
                                  ? "Remove from favourites"
                                  : "Add to favourites"
                              }
                            >
                              <IconButton
                                size="small"
                                aria-label={
                                  isFavourite
                                    ? "Remove from favourites"
                                    : "Add to favourites"
                                }
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                }}
                                onClick={() => onToggleLogFavorite(log)}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  color: isFavourite ? "#fb7185" : "#a5b4fc",
                                }}
                              >
                                {isFavourite ? (
                                  <FavoriteIcon sx={{ fontSize: "1.05rem" }} />
                                ) : (
                                  <FavoriteBorderIcon
                                    sx={{ fontSize: "1.05rem" }}
                                  />
                                )}
                              </IconButton>
                            </MuiTooltip>
                          </>
                        ) : (
                          <>
                            <MuiTooltip title="Rename (in-app only)">
                              <IconButton
                                size="small"
                                aria-label="Rename (in-app only)"
                                onClick={() => beginRename(log)}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  color: "#a5b4fc",
                                  opacity: 0.92,
                                  "&:hover": { opacity: 1 },
                                }}
                              >
                                <DriveFileRenameOutlineIcon
                                  sx={{ fontSize: "1.05rem" }}
                                />
                              </IconButton>
                            </MuiTooltip>
                            <MuiTooltip
                              title={
                                isFavourite
                                  ? "Remove from favourites"
                                  : "Add to favourites"
                              }
                            >
                              <IconButton
                                size="small"
                                aria-label={
                                  isFavourite
                                    ? "Remove from favourites"
                                    : "Add to favourites"
                                }
                                onClick={() => onToggleLogFavorite(log)}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  color: isFavourite ? "#fb7185" : "#a5b4fc",
                                  opacity: 0.92,
                                  "&:hover": { opacity: 1 },
                                }}
                              >
                                {isFavourite ? (
                                  <FavoriteIcon sx={{ fontSize: "1.05rem" }} />
                                ) : (
                                  <FavoriteBorderIcon
                                    sx={{ fontSize: "1.05rem" }}
                                  />
                                )}
                              </IconButton>
                            </MuiTooltip>
                          </>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: "1.2rem" }}>
                {showFavouritesOnly
                  ? "No favourited logs yet."
                  : "No log files found in the selected folder."}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  }
);

LogsRow.displayName = "LogsRow";
