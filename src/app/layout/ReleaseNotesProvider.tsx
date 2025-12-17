import React from "react";
import { Box, Dialog, Divider, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import { RELEASE_NOTES } from "../releaseNotes";

type ReleaseNotesContextValue = {
  appVersion: string | null;
  openReleaseNotes: () => void;
  closeReleaseNotes: () => void;
};

const ReleaseNotesContext =
  React.createContext<ReleaseNotesContextValue | null>(null);

const LAST_SEEN_RELEASE_NOTES_KEY = "tlcla:lastSeenReleaseNotesVersion";

const ReleaseNotesDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "2px",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(5,8,20,0.98))",
          border: "1px solid rgba(55,65,81,0.9)",
          boxShadow: "0 24px 48px rgba(2,6,23,0.8)",
          color: "#e5e7eb",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: { xs: 1.6, sm: 2.2 },
          pt: 1.6,
          pb: 1.2,
          display: "flex",
          alignItems: "center",
          gap: 1.2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, flex: 1, minWidth: 0 }}>
          <StickyNote2OutlinedIcon sx={{ fontSize: 22, color: "rgba(226,232,240,0.85)" }} />
          <Typography
            sx={{
              fontSize: "1.5rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: "rgba(226,232,240,0.9)",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Release Notes
          </Typography>
        </Box>

        <IconButton
          aria-label="Close release notes"
          onClick={onClose}
          sx={{
            color: "rgba(226,232,240,0.75)",
            borderRadius: 0,
            p: 0.5,
            "&:hover": {
              color: "#e0e7ff",
              backgroundColor: "rgba(2,6,23,0.35)",
            },
            "&:focus-visible": {
              outline: "none",
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: "rgba(55,65,81,0.7)" }} />

      {/* Body (scrollable) */}
      <Box
        sx={{
          px: { xs: 1.6, sm: 2.2 },
          pt: 1.4,
          pb: 1.8,
          overflowY: "auto",
          scrollSnapType: "y proximity",
          minHeight: 0,
          flex: 1,
        }}
      >
        {RELEASE_NOTES.map((patch, idx) => (
          <Box
            key={patch.version}
            sx={{
              ...(idx > 0 ? { mt: 2.2 } : null),
              ...(idx === 0 ? { minHeight: "100%", scrollSnapAlign: "start" } : null),
            }}
          >
            <Typography
              sx={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: "#c7d2fe",
              }}
            >
              Patch version: v{patch.version}
            </Typography>

            <Box sx={{ mt: 1.2 }}>
              <Box
                component="ul"
                sx={{
                  m: 0,
                  pl: 2.2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.05,
                  color: "rgba(226,232,240,0.85)",
                }}
              >
                {patch.notes.map((note) => (
                  <li key={note}>
                    <Typography sx={{ fontSize: "1rem", lineHeight: 1.45 }}>
                      {note}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>

            {idx < RELEASE_NOTES.length - 1 ? (
              <Divider sx={{ mt: 2.2, borderColor: "rgba(55,65,81,0.5)" }} />
            ) : null}
          </Box>
        ))}
      </Box>
    </Dialog>
  );
};

export const ReleaseNotesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [appVersion, setAppVersion] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const version = await window.tlcla?.app?.getVersion?.().catch(() => null);
      if (!mounted) return;
      setAppVersion(version ?? null);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!appVersion) return;
    if (typeof window === "undefined") return;
    const lastSeen = window.localStorage.getItem(LAST_SEEN_RELEASE_NOTES_KEY);
    if (lastSeen !== appVersion) {
      setOpen(true);
      window.localStorage.setItem(LAST_SEEN_RELEASE_NOTES_KEY, appVersion);
    }
  }, [appVersion]);

  const value = React.useMemo<ReleaseNotesContextValue>(
    () => ({
      appVersion,
      openReleaseNotes: () => {
        if (appVersion) {
          window.localStorage.setItem(LAST_SEEN_RELEASE_NOTES_KEY, appVersion);
        }
        setOpen(true);
      },
      closeReleaseNotes: () => setOpen(false),
    }),
    [appVersion]
  );

  return (
    <ReleaseNotesContext.Provider value={value}>
      {children}
      <ReleaseNotesDialog
        open={open}
        onClose={() => setOpen(false)}
      />
    </ReleaseNotesContext.Provider>
  );
};

export const useReleaseNotes = (): ReleaseNotesContextValue => {
  const ctx = React.useContext(ReleaseNotesContext);
  if (!ctx) {
    throw new Error("useReleaseNotes must be used within ReleaseNotesProvider");
  }
  return ctx;
};
