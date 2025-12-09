// src/components/logs/SessionsRow.tsx
import React from "react";
import { Box, Typography } from "@mui/material";
import { TimelineSession } from "../hooks/useLogsPanelLogic";

export interface SessionsRowProps {
  selectedTargetName: string | null;
  selectedSessionId: number | null;
  timelineSessions: TimelineSession[];
  onSelectSession: (sessionId: number | null) => void;
}

export const SessionsRow: React.FC<SessionsRowProps> = React.memo(
  ({
    selectedTargetName,
    selectedSessionId,
    timelineSessions,
    onSelectSession,
  }) => {
    if (!selectedTargetName || timelineSessions.length <= 1) {
      return null;
    }

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.7,
        }}
      >
        <Typography
          sx={{
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "text.secondary",
            fontSize: "1.1rem",
          }}
        >
          Sessions for {selectedTargetName}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.8,
            borderBottom: "1px solid rgba(55,65,81,0.6)",
            pb: 0.3,
          }}
        >
          <Box
            onClick={() => onSelectSession(null)}
            sx={{
              px: 1.2,
              py: 0.4,
              cursor: "pointer",
              fontSize: "1.05rem",
              borderBottom: "2px solid",
              borderColor:
                selectedSessionId == null ? "#818cf8" : "transparent",
              color: selectedSessionId == null ? "#e0e7ff" : "text.secondary",
              "&:hover": {
                borderColor: "#a5b4fc",
                color: "#e0e7ff",
              },
            }}
          >
            All
          </Box>
          {timelineSessions.map((s) => (
            <Box
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              sx={{
                px: 1.2,
                py: 0.4,
                cursor: "pointer",
                fontSize: "1.05rem",
                borderBottom: "2px solid",
                borderColor:
                  selectedSessionId === s.id ? "#818cf8" : "transparent",
                color:
                  selectedSessionId === s.id ? "#e0e7ff" : "text.secondary",
                "&:hover": {
                  borderColor: "#a5b4fc",
                  color: "#e0e7ff",
                },
              }}
            >
              Session {s.id}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }
);

SessionsRow.displayName = "SessionsRow";
