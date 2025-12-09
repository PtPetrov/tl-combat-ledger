// src/components/logs/LogsAnalyzerView.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import {
  LoadState,
  LogFileInfo,
  SkillBreakdown,
  TargetBreakdown,
} from "../types/logTypes";
import { TimelineSession, TimelineSeries } from "../hooks/useLogsPanelLogic";
import { AnalyzerHeader } from "./AnalyzerHeader";
import { DefaultDirectoriesRow } from "./DefaultDirectoriesRow";
import { SessionsRow } from "./SessionsRow";
import { SkillsTableSection } from "./SkillsTableSection";
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

export interface LogsAnalyzerViewProps {
  defaultDirs: string[];
  selectedDir: string | null;
  logs: LogFileInfo[];
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
  timelineChartData: Array<Record<string, number>>;
  timelineSeries: TimelineSeries[];
  timelineSessions: TimelineSession[];

  onSelectFolder: () => void;
  onRefresh: () => void;
  onSelectLog: (log: LogFileInfo) => void;
  onSelectDefaultDir: (dir: string) => void;
  onSelectTarget: (targetName: string | null) => void;
  onSelectSession: (sessionId: number | null) => void;
  onToggleCompare?: () => void;
  isCompareActive?: boolean;
  showCompareControl?: boolean;
  viewLabel?: string;
}

export const LogsAnalyzerView: React.FC<LogsAnalyzerViewProps> = ({
  defaultDirs,
  selectedDir,
  logs,
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
  timelineChartData,
  timelineSeries,
  timelineSessions,
  onSelectFolder,
  onRefresh,
  onSelectLog,
  onSelectDefaultDir,
  onSelectTarget,
  onSelectSession,
  onToggleCompare,
  isCompareActive,
  showCompareControl = true,
  viewLabel,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSkill, setSelectedSkill] =
    useState<ExtendedSkillBreakdown | null>(null);
  const [updateStatus, setUpdateStatus] =
    useState<UpdateStatusPayload | null>(null);
  const updatesApiRef = useRef<UpdatesApi | null>(null);
  const [hasUpdateBridge, setHasUpdateBridge] = useState(false);
  const { viewportHeight, mainAreaHeight, timelineHeight, attackCardHeight } =
    useDynamicLayoutHeights();

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
    updatesApiRef.current = api;
    setHasUpdateBridge(true);

    const unsubscribe = api.onStatus((status) => {
      setUpdateStatus(status);
    });

    api.checkForUpdates().catch((error) => {
      console.warn("Update check failed", error);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCheckForUpdates = useCallback(() => {
    updatesApiRef.current?.checkForUpdates().catch((error) => {
      console.warn("Failed to check for updates", error);
    });
  }, []);

  const handleInstallUpdate = useCallback(() => {
    updatesApiRef.current?.installUpdate().catch((error) => {
      console.warn("Failed to install update", error);
    });
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: viewportHeight,
        minHeight: viewportHeight,
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
      />
      <DefaultDirectoriesRow
        defaultDirs={defaultDirs}
        selectedDir={selectedDir}
        onSelectDefaultDir={onSelectDefaultDir}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: sectionSpacing,
          minHeight: 0,
          flex: 1,
          overflow: "hidden",
          height: mainAreaHeight,
        }}
      >
        <LogsTargetsSidebar
          logs={logs}
          state={state}
          error={error}
          hasLogs={hasLogs}
          selectedLog={selectedLog}
          onSelectLog={onSelectLog}
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
          contentHeight={mainAreaHeight}
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
                lg: "minmax(0, 0.7fr) minmax(0, 0.3fr)",
              },
              gap: sectionSpacing,
            }}
          >
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
                  boxShadow:
                    "0 0 0 1px rgba(15,23,42,0.9), 0 18px 40px rgba(15,23,42,0.9)",
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
                      <span>Damage</span>
                      <span>Share</span>
                      <span>Hits</span>
                      <span>Crit</span>
                      <span>Heavy</span>
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

            <Box
              sx={{
                minHeight: 0,
                height: "100%",
              }}
            >
              <SkillDetailsCard
                summaryState={summaryState}
                currentTopSkills={currentTopSkills}
                currentDurationSeconds={currentDurationSeconds}
                selectedSkill={selectedSkill}
                maxHeight={attackCardHeight}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
