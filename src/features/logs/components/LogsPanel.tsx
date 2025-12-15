// src/components/logs/LogsPanel.tsx
import React, { useState } from "react";
import { Box } from "@mui/material";
import {
  useLogsPanelLogic,
  UseLogsPanelLogicResult,
} from "../hooks/useLogsPanelLogic";
import { LogsAnalyzerView, LogsAnalyzerViewProps } from "./LogsAnalyzerView";
import { trackUsage } from "../../../telemetry/telemetry";

type AnalyzerViewBaseProps = Omit<
  LogsAnalyzerViewProps,
  "onToggleCompare" | "isCompareActive" | "showCompareControl" | "viewLabel"
>;

const buildAnalyzerViewProps = ({
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
  timelineChartData,
  timelineSeries,
  timelineSessions,
  handleSelectFolder,
  handleRefresh,
  handleSelectLog,
  handleRenameLog,
  handleToggleLogFavorite,
  handleSelectTarget,
  handleSelectSession,
}: UseLogsPanelLogicResult): AnalyzerViewBaseProps => ({
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
  timelineChartData,
  timelineSeries,
  timelineSessions,
  onSelectFolder: handleSelectFolder,
  onRefresh: handleRefresh,
  onSelectLog: handleSelectLog,
  onRenameLog: handleRenameLog,
  onToggleLogFavorite: handleToggleLogFavorite,
  onSelectTarget: handleSelectTarget,
  onSelectSession: handleSelectSession,
});

const LogsPanel: React.FC = () => {
  const [isCompareMode, setIsCompareMode] = useState(false);
  const primaryLogic = useLogsPanelLogic();
  const primaryProps = buildAnalyzerViewProps(primaryLogic);

  const handleToggleCompare = () => {
    setIsCompareMode((prev) => {
      const next = !prev;
      trackUsage(next ? "compare.enabled" : "compare.disabled");
      return next;
    });
  };

  const primaryView = (
    <LogsAnalyzerView
      {...primaryProps}
      onToggleCompare={handleToggleCompare}
      isCompareActive={isCompareMode}
      showCompareControl
      viewLabel={isCompareMode ? "Primary" : undefined}
    />
  );

  const compareLayout = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        gap: 2,
        minHeight: 0,
        minWidth: 0,
        height: "100%",
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          display: "flex",
          width: "100%",
          "& > *": {
            flex: 1,
            minHeight: 0,
          },
        }}
      >
        {primaryView}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          display: "flex",
          width: "100%",
          "& > *": {
            flex: 1,
            minHeight: 0,
          },
        }}
      >
        <ComparisonAnalyzerView />
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        minHeight: 0,
        minWidth: 0,
        overflow: "auto",
      }}
    >
      {isCompareMode ? compareLayout : primaryView}
    </Box>
  );
};

const ComparisonAnalyzerView: React.FC = () => {
  const comparisonLogic = useLogsPanelLogic();
  const comparisonProps = buildAnalyzerViewProps(comparisonLogic);

  return (
    <LogsAnalyzerView
      {...comparisonProps}
      showCompareControl={false}
      isCompareActive
      viewLabel="Comparison"
    />
  );
};

export default LogsPanel;
