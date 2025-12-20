// src/App.tsx
import React from "react";
import AppLayout from "./layout/AppLayout";
import { LogsPanel } from "../features/logs/components";
import { ReleaseNotesProvider } from "./layout/ReleaseNotesProvider";

const App: React.FC = () => {
  return (
    <ReleaseNotesProvider>
      <AppLayout>
        <LogsPanel />
      </AppLayout>
    </ReleaseNotesProvider>
  );
};

export default App;
