import { useEffect, useState } from "react";
import { Navigation, type Page } from "./components/Common/Navigation";
import { getRunningTimer } from "./db/timeEntries";
import { CustomersPage } from "./pages/CustomersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TimerPage } from "./pages/TimerPage";
import { TimesheetPage } from "./pages/TimesheetPage";
import type { RunningTimer } from "./types";
import "./styles.css";

export default function App() {
  const [page, setPage] = useState<Page>("timer");
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    getRunningTimer().then(setRunningTimer).catch((error) => setStartupError(String(error)));
  }, []);

  return (
    <div className="app-shell">
      <Navigation page={page} onChange={setPage} running={Boolean(runningTimer)} />
      <main className="content">
        {startupError && <div className="alert error startup-error">Database startup failed: {startupError}</div>}
        {page === "timer" && <TimerPage runningTimer={runningTimer} onTimerChange={setRunningTimer} />}
        {page === "customers" && <CustomersPage />}
        {page === "timesheet" && <TimesheetPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
