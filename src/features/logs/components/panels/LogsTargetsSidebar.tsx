import React, { useEffect, useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DescriptionIcon from "@mui/icons-material/Description";
import PersonIcon from "@mui/icons-material/Person";
import {
  LoadState,
  LogFileInfo,
  SkillBreakdown,
  TargetBreakdown,
} from "../../types/logTypes";
import { CharacterClassCard } from "../cards/CharacterClassCard";
import { LogsRow, TargetsRow } from "../rows";
import { sectionSpacing } from "../ui";

export interface LogsTargetsSidebarProps {
  logs: LogFileInfo[];
  state: LoadState;
  error: string | null;
  hasLogs: boolean;
  selectedLog: LogFileInfo | null;
  onSelectLog: (log: LogFileInfo) => void;
  onRenameLog: (log: LogFileInfo, nextName: string) => void;
  logFavorites: Record<string, true>;
  onToggleLogFavorite: (log: LogFileInfo) => void;
  onDeleteLog: (log: LogFileInfo) => void;
  onRefresh: () => void;
  onSelectFolder: () => void;
  selectedDir: string | null;

  summaryState: LoadState;
  topTargets: TargetBreakdown[];
  overallTotalDamage: number;
  selectedTargetName: string | null;
  onSelectTarget: (targetName: string | null) => void;

  characterName: string | null;
  currentTopSkills: SkillBreakdown[];

  isOpen: boolean;
  onToggle: () => void;
}

export const LogsTargetsSidebar: React.FC<LogsTargetsSidebarProps> = React.memo(
  ({
    logs,
    state,
    error,
    hasLogs,
    selectedLog,
    onSelectLog,
    onRenameLog,
    logFavorites,
    onToggleLogFavorite,
    onDeleteLog,
    onRefresh,
    onSelectFolder,
    selectedDir,
    summaryState,
    topTargets,
    overallTotalDamage,
    selectedTargetName,
    onSelectTarget,
    characterName,
    currentTopSkills,
    isOpen,
    onToggle,
  }) => {
    const [appVersion, setAppVersion] = useState<string | null>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const appApi = window.tlcla?.app;
      if (!appApi?.getVersion) return;

      let cancelled = false;

      appApi
        .getVersion()
        .then((version) => {
          if (cancelled) return;
          setAppVersion(version);
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn("Failed to fetch app version", error);
        });

      return () => {
        cancelled = true;
      };
    }, []);

    return (
      <Box
        sx={{
          position: "relative",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          width: {
            xs: "100%",
            md: isOpen ? 320 : 32,
            xl: isOpen ? 360 : 34,
          },
          transition: "width 180ms cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "width",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            borderRadius: "2px",
            border: "1px solid rgba(30,41,59,0.9)",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
            boxShadow: "inset 0 0 20px rgba(15,23,42,0.65)",
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? "translateX(0)" : "translateX(-12px)",
            transition: "opacity 150ms ease-out, transform 180ms ease-out",
            pointerEvents: isOpen ? "auto" : "none",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "grid",
              gridTemplateRows: "auto auto minmax(0, 1fr)",
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                minHeight: 0,
              }}
            >
              <CharacterClassCard
                characterName={characterName}
                currentTopSkills={currentTopSkills}
                variant="sidebar"
              />
            </Box>
            <Box
              sx={{
                borderRadius: "2px",
                border: "1px solid rgba(30,41,59,0.6)",
                backgroundColor: "rgba(10,16,28,0.9)",
                p: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <LogsRow
                logs={logs}
                state={state}
                error={error}
                hasLogs={hasLogs}
                selectedLog={selectedLog}
                onSelectLog={onSelectLog}
                onRenameLog={onRenameLog}
                logFavorites={logFavorites}
                onToggleLogFavorite={onToggleLogFavorite}
                onDeleteLog={onDeleteLog}
                onRefresh={onRefresh}
                onSelectFolder={onSelectFolder}
                selectedDir={selectedDir}
              />
            </Box>
            <Box
              sx={{
                borderRadius: "2px",
                border: "1px solid rgba(30,41,59,0.6)",
                backgroundColor: "rgba(10,16,28,0.9)",
                p: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <TargetsRow
                summaryState={summaryState}
                topTargets={topTargets}
                overallTotalDamage={overallTotalDamage}
                selectedTargetName={selectedTargetName}
                onSelectTarget={onSelectTarget}
                fillHeight
              />
            </Box>
          </Box>

          <Box
            sx={{
              borderTop: "1px solid rgba(30,41,59,0.8)",
              px: sectionSpacing,
              py: sectionSpacing,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: { xs: 1, md: 1.4 },
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                letterSpacing: "0.12em",
                fontSize: "0.95rem",
                whiteSpace: "nowrap",
                opacity: appVersion ? 0.85 : 0.6,
              }}
            >
              {appVersion ? `v${appVersion}` : "Dev build"}
            </Typography>

            <Tooltip
              title={isOpen ? "Hide logs & targets" : "Show logs & targets"}
            >
              <IconButton
                size="small"
                onClick={onToggle}
                sx={{
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  width: 32,
                  height: 32,
                  color: "#a5b4fc",
                  "&:hover": {
                    backgroundColor: "rgba(79,70,229,0.2)",
                  },
                  backdropFilter: "blur(6px)",
                }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {!isOpen && (
          <>
            <Box
              component="button"
              type="button"
              aria-label="Show logs & targets"
              onClick={onToggle}
              sx={{
                position: "absolute",
                top: 16,
                left: 0,
                right: 0,
                mx: "auto",
                width: "fit-content",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.1,
                color: "text.secondary",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 2px",
              }}
            >
              <DescriptionIcon sx={{ fontSize: "1.4rem" }} />
              <PersonIcon sx={{ fontSize: "1.4rem" }} />
            </Box>
            <Tooltip title="Show logs & targets">
              <IconButton
                size="small"
                onClick={onToggle}
                sx={{
                  position: "absolute",
                  bottom: 16,
                  left: 0,
                  right: 0,
                  mx: "auto",
                  width: 28,
                  transform: "none",
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  height: 28,
                  color: "#a5b4fc",
                  "&:hover": {
                    backgroundColor: "rgba(79,70,229,0.2)",
                  },
                  backdropFilter: "blur(6px)",
                }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    );
  }
);

LogsTargetsSidebar.displayName = "LogsTargetsSidebar";
