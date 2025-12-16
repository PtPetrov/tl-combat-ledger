// src/components/logs/LogsAnalyzerView.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, TableSortLabel } from "@mui/material";
import {
  LoadState,
  DamageTimelineBucket,
  LogFileInfo,
  SkillBreakdown,
  TargetBreakdown,
} from "../types/logTypes";
import { TimelineSession, TimelineSeries } from "../hooks/useLogsPanelLogic";
import { AnalyzerHeader } from "./AnalyzerHeader";
import { SessionsRow } from "./SessionsRow";
import { SkillsTableSection } from "./SkillsTableSection";
import type {
  SkillsTableSortDirection,
  SkillsTableSortKey,
} from "./SkillsTableSection";
import { StatsPanel } from "./StatsPanel";
import { CharacterClassView } from "./CharacterClassView";
import { DamageTimelineCard } from "./DamageTimelineCard";
import { SkillDetailsCard } from "./SkillDetailsCard";
import { LogsTargetsSidebar } from "./LogsTargetsSidebar";
import { ExtendedSkillBreakdown } from "../utils/logsViewUtils";
import {
  contentPaddingX,
  contentPaddingY,
  sectionSpacing,
} from "./layoutTokens";
import { useDynamicLayoutHeights } from "../hooks/useDynamicLayoutHeights";
import type {
  UpdateStatusPayload,
  UpdatesApi,
} from "../types/updateTypes";
import { trackUsage } from "../../../telemetry/telemetry";

export interface LogsAnalyzerViewProps {
  selectedDir: string | null;
  logs: LogFileInfo[];
  logFavorites: Record<string, true>;
  state: LoadState;
  error: string | null;
  hasLogs: boolean;

  selectedLog: LogFileInfo | null;
  summaryState: LoadState;
  summaryError: string | null;

  selectedSummaryTitle: string;
  characterName: string | null;

  overallTotalDamage: number;
  overallTotalEvents: number;
  overallDurationSeconds: number | null;

  selectedTargetName: string | null;
  selectedSessionId: number | null;

  currentTotalDamage: number;
  currentTotalEvents: number;
  currentDps: number | null;
  currentCritRate: number | null;
  currentDurationSeconds: number | null;
  currentTopSkills: SkillBreakdown[];

  targets: TargetBreakdown[];
  topTargets: TargetBreakdown[];

  hasTimeline: boolean;
  timeline: DamageTimelineBucket[];
  timelineChartData: Array<Record<string, number>>;
  timelineSeries: TimelineSeries[];
  timelineSessions: TimelineSession[];

  onSelectFolder: () => void;
  onRefresh: () => void;
  onSelectLog: (log: LogFileInfo) => void;
  onRenameLog: (log: LogFileInfo, nextName: string) => void;
  onToggleLogFavorite: (log: LogFileInfo) => void;
  onSelectTarget: (targetName: string | null) => void;
  onSelectSession: (sessionId: number | null) => void;
  onToggleCompare?: () => void;
  isCompareActive?: boolean;
  showCompareControl?: boolean;
  viewLabel?: string;
}

export const LogsAnalyzerView: React.FC<LogsAnalyzerViewProps> = ({
  selectedDir,
  logs,
  logFavorites,
  state,
  error,
  hasLogs,
  selectedLog,
  summaryState,
  summaryError,
  selectedSummaryTitle,
  characterName,
  overallTotalDamage,
  overallTotalEvents,
  overallDurationSeconds,
  selectedTargetName,
  selectedSessionId,
  currentTotalDamage,
  currentTotalEvents,
  currentDps,
  currentCritRate,
  currentDurationSeconds,
  currentTopSkills,
  targets,
  topTargets,
  hasTimeline,
  timeline,
  timelineChartData,
  timelineSeries,
  timelineSessions,
  onSelectFolder,
  onRefresh,
  onSelectLog,
  onRenameLog,
  onToggleLogFavorite,
  onSelectTarget,
  onSelectSession,
  onToggleCompare,
  isCompareActive,
  showCompareControl = true,
  viewLabel,
}) => {
  const compareLayoutActive = Boolean(isCompareActive);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSkill, setSelectedSkill] =
    useState<ExtendedSkillBreakdown | null>(null);
  const [updateStatus, setUpdateStatus] =
    useState<UpdateStatusPayload | null>(null);
  const updatesApiRef = useRef<UpdatesApi | null>(null);
  const [hasUpdateBridge, setHasUpdateBridge] = useState(false);
  const { timelineHeight } = useDynamicLayoutHeights();
  const [skillsSort, setSkillsSort] = useState<{
    key: SkillsTableSortKey | null;
    direction: SkillsTableSortDirection;
  }>({ key: null, direction: "desc" });

  useEffect(() => {
    if (summaryState !== "loaded" || currentTopSkills.length === 0) {
      setSelectedSkill(null);
      return;
    }
    setSelectedSkill((prev) => {
      if (!prev) {
        return currentTopSkills[0] as ExtendedSkillBreakdown;
      }
      const stillExists = currentTopSkills.some(
        (skill) => skill.skillName === prev.skillName
      );
      return stillExists
        ? prev
        : (currentTopSkills[0] as ExtendedSkillBreakdown);
    });
  }, [summaryState, currentTopSkills]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const api = window.tlcla?.updates;
    if (!api) return;
    const isDevBuild = import.meta.env.DEV;
    updatesApiRef.current = api;
    setHasUpdateBridge(true);

    const unsubscribe = api.onStatus((status) => {
      setUpdateStatus(status);
    });

    if (!isDevBuild) {
      trackUsage("update.check.auto");
      api.checkForUpdates().catch((error) => {
        console.warn("Update check failed", error);
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCheckForUpdates = useCallback(() => {
    trackUsage("update.check.manual");
    updatesApiRef.current?.checkForUpdates().catch((error) => {
      console.warn("Failed to check for updates", error);
    });
  }, []);

  const handleInstallUpdate = useCallback(() => {
    trackUsage("update.install");
    updatesApiRef.current?.installUpdate().catch((error) => {
      console.warn("Failed to install update", error);
    });
  }, []);

  const handleSortColumn = useCallback((key: SkillsTableSortKey) => {
    setSkillsSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "desc" ? "asc" : "desc",
        };
      }
      return { key, direction: "desc" };
    });
  }, []);

  const sortLabelSx = {
    justifyContent: "flex-start",
    "& .MuiTableSortLabel-icon": {
      color: "rgba(148,163,184,0.55) !important",
      opacity: 0.65,
    },
    "&.Mui-active": {
      color: "#e0e7ff",
    },
    "&.Mui-active .MuiTableSortLabel-icon": {
      color: "#a5b4fc !important",
      opacity: 1,
    },
  } as const;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        width: "100%",
        minWidth: 0,
        bgcolor: "#020617",
        color: "#e5e7eb",
        px: contentPaddingX,
        py: contentPaddingY,
        gap: sectionSpacing,
        fontSize: "1.2rem",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <AnalyzerHeader
        onToggleCompare={onToggleCompare}
        isCompareActive={isCompareActive}
        showCompareControl={showCompareControl}
        contextLabel={viewLabel}
        updateStatus={hasUpdateBridge ? updateStatus : null}
        onCheckForUpdates={
          hasUpdateBridge ? handleCheckForUpdates : undefined
        }
        onInstallUpdate={
          hasUpdateBridge ? handleInstallUpdate : undefined
        }
        exportFileBaseName={selectedSummaryTitle}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: sectionSpacing,
          minHeight: 0,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <LogsTargetsSidebar
          logs={logs}
          state={state}
          error={error}
          hasLogs={hasLogs}
          selectedLog={selectedLog}
          onSelectLog={onSelectLog}
          onRenameLog={onRenameLog}
          logFavorites={logFavorites}
          onToggleLogFavorite={onToggleLogFavorite}
          onRefresh={onRefresh}
          onSelectFolder={onSelectFolder}
          selectedDir={selectedDir}
          summaryState={summaryState}
          topTargets={topTargets}
          overallTotalDamage={overallTotalDamage}
          selectedTargetName={selectedTargetName}
          onSelectTarget={onSelectTarget}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />

        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: sectionSpacing,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <SessionsRow
            selectedTargetName={selectedTargetName}
            selectedSessionId={selectedSessionId}
            timelineSessions={timelineSessions}
            onSelectSession={onSelectSession}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "repeat(2, minmax(0, 1fr))",
              },
              gap: sectionSpacing,
            }}
          >
            <CharacterClassView
              characterName={characterName}
              currentTopSkills={currentTopSkills}
            />
            <StatsPanel
              summaryState={summaryState}
              selectedSummaryTitle={selectedSummaryTitle}
              currentTotalDamage={currentTotalDamage}
              currentDps={currentDps}
              currentDurationSeconds={currentDurationSeconds}
              selectedTargetName={selectedTargetName}
              selectedSessionId={selectedSessionId}
            />
          </Box>

          <Box
            sx={{
              flex: `0 0 ${timelineHeight}px`,
              minHeight: timelineHeight,
            }}
          >
            <DamageTimelineCard
              summaryState={summaryState}
              hasTimeline={hasTimeline}
              timeline={timeline}
              timelineSeries={timelineSeries}
              timelineChartData={timelineChartData}
              selectedTargetName={selectedTargetName}
              selectedSessionId={selectedSessionId}
              timelineSessions={timelineSessions}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: compareLayoutActive
                  ? "1fr"
                  : "minmax(0, 0.7fr) minmax(0, 0.3fr)",
              },
              gridTemplateRows: compareLayoutActive
                ? "auto minmax(0, 1fr)"
                : undefined,
              gap: sectionSpacing,
            }}
          >
            {compareLayoutActive && (
              <Box sx={{ minHeight: 0 }}>
                <SkillDetailsCard
                  summaryState={summaryState}
                  currentTopSkills={currentTopSkills}
                  currentDurationSeconds={currentDurationSeconds}
                  selectedSkill={selectedSkill}
                  layout="compare"
                />
              </Box>
            )}

            <Box
              sx={{
                minHeight: 0,
                height: "100%",
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "2px",
                  overflow: "hidden",
                  border: "1px solid rgba(15,23,42,0.9)",
                  backgroundColor: "#050814",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflowX: "auto",
                  }}
                >
                  <Box
                    sx={{
                      minWidth: 640,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                    }}
                  >
                    <Box
                      sx={{
                        px: { xs: 1.4, md: 2 },
                        py: { xs: 0.8, md: 1.1 },
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "2.4fr 1.2fr 1.4fr",
                          sm: "2.4fr 1.2fr 1.6fr 1fr",
                          md: "2.4fr 1.4fr 1.8fr 1fr 1.2fr 1.2fr",
                        },
                        columnGap: { xs: 1.2, md: 2.2 },
                        fontSize: { xs: "1rem", md: "1.2rem" },
                        borderBottom: "1px solid rgba(55,65,81,0.95)",
                        background:
                          "linear-gradient(90deg, rgba(17,24,39,1), rgba(15,23,42,1))",
                        color: "text.secondary",
                      }}
	                    >
	                      <span>Skill</span>
	                      <TableSortLabel
	                        active={skillsSort.key === "damage"}
	                        hideSortIcon
	                        direction={
	                          skillsSort.key === "damage"
	                            ? skillsSort.direction
	                            : "desc"
	                        }
	                        onClick={() => handleSortColumn("damage")}
	                        sx={sortLabelSx}
	                      >
	                        Damage
	                      </TableSortLabel>
	                      <TableSortLabel
	                        active={skillsSort.key === "share"}
	                        hideSortIcon
	                        direction={
	                          skillsSort.key === "share"
	                            ? skillsSort.direction
	                            : "desc"
	                        }
	                        onClick={() => handleSortColumn("share")}
	                        sx={sortLabelSx}
	                      >
	                        Share
	                      </TableSortLabel>
	                      <TableSortLabel
	                        active={skillsSort.key === "hits"}
	                        hideSortIcon
	                        direction={
	                          skillsSort.key === "hits"
	                            ? skillsSort.direction
	                            : "desc"
	                        }
	                        onClick={() => handleSortColumn("hits")}
	                        sx={sortLabelSx}
	                      >
	                        Hits
	                      </TableSortLabel>
	                      <TableSortLabel
	                        active={skillsSort.key === "crit"}
	                        hideSortIcon
	                        direction={
	                          skillsSort.key === "crit"
	                            ? skillsSort.direction
	                            : "desc"
	                        }
	                        onClick={() => handleSortColumn("crit")}
	                        sx={sortLabelSx}
	                      >
	                        Crit
	                      </TableSortLabel>
	                      <TableSortLabel
	                        active={skillsSort.key === "heavy"}
	                        hideSortIcon
	                        direction={
	                          skillsSort.key === "heavy"
	                            ? skillsSort.direction
	                            : "desc"
	                        }
	                        onClick={() => handleSortColumn("heavy")}
	                        sx={sortLabelSx}
	                      >
	                        Heavy
	                      </TableSortLabel>
	                    </Box>

                    <Box
                      sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                      }}
                    >
	                      <SkillsTableSection
	                        summaryState={summaryState}
	                        summaryError={summaryError}
	                        selectedLog={selectedLog}
	                        currentTopSkills={currentTopSkills}
	                        currentTotalDamage={currentTotalDamage}
	                        sortKey={skillsSort.key}
	                        sortDirection={skillsSort.direction}
	                        onSelectSkill={(skill) =>
	                          setSelectedSkill(skill as ExtendedSkillBreakdown)
	                        }
	                        selectedSkillName={selectedSkill?.skillName ?? null}
	                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            {!compareLayoutActive && (
              <Box sx={{ minHeight: 0, height: "100%" }}>
                <SkillDetailsCard
                  summaryState={summaryState}
                  currentTopSkills={currentTopSkills}
                  currentDurationSeconds={currentDurationSeconds}
                  selectedSkill={selectedSkill}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
