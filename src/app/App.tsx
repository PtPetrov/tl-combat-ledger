// src/App.tsx
import React from "react";
import AppLayout from "./layout/AppLayout";
import LogsPanel from "../features/logs/components/LogsPanel";

const App: React.FC = () => {
  return (
    <AppLayout>
      <LogsPanel />
    </AppLayout>
  );
};

export default App;
