import { unstable_createMuiStrictModeTheme } from "@mui/material/styles";

export const tlTheme = unstable_createMuiStrictModeTheme({
  palette: {
    mode: "dark",
    primary: {
      // gold-ish accent similar to TL menus
      main: "#fbbf24",
    },
    secondary: {
      // cyan accent used for highlights
      main: "#38bdf8",
    },
    background: {
      default: "#050814",
      paper: "rgba(15,23,42,0.98)",
    },
    text: {
      primary: "#e5e7eb",
      secondary: "#9ca3af",
    },
  },
  typography: {
    fontFamily: [
      "Poppins",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "sans-serif",
    ].join(","),
    button: {
      textTransform: "none",
      letterSpacing: 0.03,
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            "radial-gradient(circle at top left, rgba(148,163,184,0.15), transparent)",
          border: "1px solid rgba(15,23,42,0.9)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
  },
});
