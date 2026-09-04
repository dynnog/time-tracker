import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Navigation, type Page } from "./components/Common/Navigation";
import { MeetingCoordinator } from "./components/Meeting/MeetingCoordinator";
import { getRunningTimer, stopTimer } from "./db/timeEntries";
import { CustomersPage } from "./pages/CustomersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TimerPage } from "./pages/TimerPage";
import { TimesheetPage } from "./pages/TimesheetPage";
import type { MeetingSession, RunningTimer } from "./types";
import { notify } from "./services/notificationService";
import { elapsedSeconds } from "./utils/time";
import "./styles.css";

export default function App() {
  const [page, setPage] = useState<Page>("timer");
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [startupError, setStartupError] = useState("");
  const [activeMeeting, setActiveMeeting] = useState<MeetingSession | null>(null);

  useEffect(() => {
    getRunningTimer().then(setRunningTimer).catch((error) => setStartupError(String(error)));
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("tray-stop-active-tracking", () => {
      if (runningTimer) {
        const stoppedTimer = runningTimer;
        void stopTimer().then(() => {
          setRunningTimer(null);
          window.dispatchEvent(new Event("time-entry-changed"));
          void notify("Timer stopped", `${stoppedTimer.customer_name} — ${stoppedTimer.activity_name}`);
        }).catch((error) => setStartupError(String(error)));
      } else {
        window.dispatchEvent(new Event("tray-stop-meeting"));
      }
    }).then((cleanup) => { unlisten = cleanup; }).catch((error) => setStartupError(String(error)));
    return () => unlisten?.();
  }, [runningTimer]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("quick-timer-started", () => {
      void getRunningTimer().then(setRunningTimer).catch((error) => setStartupError(String(error)));
    }).then((cleanup) => { unlisten = cleanup; }).catch((error) => setStartupError(String(error)));
    return () => unlisten?.();
  }, []);

  function openQuickStart() {
    void invoke("open_quick_start").catch((error) => setStartupError(String(error)));
  }

  useEffect(() => {
    const startTime = runningTimer?.start_time ?? activeMeeting?.start_time;
    const label = runningTimer ? "Timer" : activeMeeting ? `${activeMeeting.application_name} Meeting` : "";
    void invoke("tray_set_tracking_state", {
      active: Boolean(startTime),
      elapsedSeconds: startTime ? elapsedSeconds(startTime) : 0,
      label,
    }).catch((error) => setStartupError(String(error)));
  }, [runningTimer, activeMeeting]);

  return (
    <div className="app-shell">
      <Navigation page={page} onChange={setPage} running={Boolean(runningTimer || activeMeeting)} onQuickStart={openQuickStart} />
      <main className="content">
        <MeetingCoordinator runningTimer={runningTimer} onTimerChange={setRunningTimer} onMeetingTrackingChange={setActiveMeeting} />
        {startupError && <div className="alert error startup-error">Database startup failed: {startupError}</div>}
        {page === "timer" && <TimerPage runningTimer={runningTimer} onTimerChange={setRunningTimer} />}
        {page === "customers" && <CustomersPage />}
        {page === "timesheet" && <TimesheetPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
