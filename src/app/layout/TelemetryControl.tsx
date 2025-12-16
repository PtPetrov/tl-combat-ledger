import React from "react";
import {
  Box,
  Divider,
  FormControlLabel,
  IconButton,
  Popover,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import PrivacyTipOutlinedIcon from "@mui/icons-material/PrivacyTipOutlined";
import type { TelemetrySettings } from "../../types/telemetryTypes";
import {
  getTelemetrySettings,
  subscribeTelemetrySettings,
  updateTelemetrySettings,
} from "../../telemetry/telemetry";

const formatStatus = (settings: TelemetrySettings): string => {
  const crash = settings.crashReportsEnabled;
  if (crash) return "Crash reports: on";
  return "Crash reports: off";
};

export const TelemetryControl: React.FC = () => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [settings, setSettings] = React.useState<TelemetrySettings>(
    getTelemetrySettings()
  );

  React.useEffect(() => subscribeTelemetrySettings(setSettings), []);

  const open = Boolean(anchorEl);
  const tooltip = formatStatus(settings);

  return (
    <>
      <Tooltip
        title={tooltip}
        placement="top"
        enterDelay={250}
      >
        <IconButton
          aria-label="Privacy & telemetry"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            width: 34,
            height: 34,
            color: "rgba(226,232,240,0.9)",
            "&:hover": { color: "#c7d2fe" },
          }}
        >
          <PrivacyTipOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: 440,
            maxWidth: "calc(100vw - 24px)",
            borderRadius: 2,
            p: 1.6,
            backgroundColor: "rgba(15,23,42,0.98)",
            border: "1px solid rgba(55,65,81,0.9)",
            color: "#e5e7eb",
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: "0.08em" }}>
              Privacy
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={settings.crashReportsEnabled}
                onChange={async (_e, checked) => {
                  try {
                    await updateTelemetrySettings({ crashReportsEnabled: checked });
                  } catch (error) {
                    console.warn("Failed to update crash report setting", error);
                  }
                }}
              />
            }
            label="Crash Reports"
          />
          <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", lineHeight: 1.5 }}>
            When enabled, we send anonymous crash and error information so we can fix problems
            quickly. This may include: the error message, technical stack trace, app version, and
            Windows version.
          </Typography>

          <Divider sx={{ borderColor: "rgba(55,65,81,0.7)" }} />

          <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Anonymous usage analytics is collected to understand how many users actively use the
            app and which features matter. This includes a random, anonymous installation ID to
            estimate unique users.
          </Typography>

          <Divider sx={{ borderColor: "rgba(55,65,81,0.7)" }} />

          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
            What we do NOT collect
          </Typography>
          <Box sx={{ color: "text.secondary", fontSize: "0.9rem", lineHeight: 1.55 }}>
            <div>Combat log contents or any parsed combat text</div>
            <div>Any files, file contents, or file paths</div>
            <div>Character names, account names, guild names, or chat</div>
            <div>Personal identifiers (email, phone, etc.)</div>
          </Box>
        </Box>
      </Popover>
    </>
  );
};
