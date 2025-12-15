import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/global.css";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { tlTheme } from "./theme/theme";
import { loadTelemetrySettings } from "./telemetry/telemetry";

const renderApp = () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider theme={tlTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
};

void loadTelemetrySettings().catch(() => undefined).finally(renderApp);
