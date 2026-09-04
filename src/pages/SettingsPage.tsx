import { useEffect, useState } from "react";
import {
  isMeetingDetectionEnabled,
  meetingDetector,
  setMeetingDetectionEnabled,
  type MeetingDetectionStatus,
  type MeetingEvent,
  type MeetingEventContext,
} from "../services/meetingService";
import {
  areNativeNotificationsEnabled,
  setNativeNotificationsEnabled,
} from "../services/notificationService";

interface EventRecord {
  id: number;
  event: MeetingEvent;
  occurredAt: Date;
}

export function SettingsPage() {
  const [status, setStatus] = useState<MeetingDetectionStatus | null>(() => meetingDetector.getStatus());
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(isMeetingDetectionEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = useState(areNativeNotificationsEnabled);

  useEffect(() => {
    const record = (context: MeetingEventContext) => setEvents((current) => [
      { id: Date.now(), event: context.event, occurredAt: new Date() },
      ...current,
    ].slice(0, 20));
    const unsubscribeStatus = meetingDetector.onStatusChanged(setStatus);
    const unsubscribeStarted = meetingDetector.onMeetingStarted(record);
    const unsubscribeEnded = meetingDetector.onMeetingEnded(record);
    return () => {
      unsubscribeStatus();
      unsubscribeStarted();
      unsubscribeEnded();
    };
  }, []);

  async function setDetectionRunning(running: boolean) {
    setBusy(true);
    setError("");
    try {
      setMeetingDetectionEnabled(running);
      setEnabled(running);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications() {
    setBusy(true);
    setError("");
    try {
      const next = !notificationsEnabled;
      const granted = await setNativeNotificationsEnabled(next);
      setNotificationsEnabled(granted);
      if (next && !granted) setError("Notification permission was not granted. You can enable it in your system settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Diagnostics</p>
        <h1>Meeting Detection</h1>
        <p>Manage automatic meeting tracking and inspect its Teams and Zoom signals.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="detector-grid">
        <section className="detector-card">
          <div className="detector-heading">
            <div>
              <h2>Meeting detector</h2>
              <p>{status?.platform ?? "Desktop"}</p>
            </div>
            <span className={`status-pill ${status?.running ? "" : "inactive"}`}>
              {status?.running ? "Monitoring" : "Stopped"}
            </span>
          </div>

          <div className={`signal-state ${status?.detected ? "detected" : ""}`}>
            <span>Current signal</span>
            <strong>{status?.detected ? "Meeting Started" : "No Meeting"}</strong>
          </div>

          <div className="application-signals">
            {status?.applications.length ? status.applications.map((application) => (
              <div className="application-signal" key={application.id}>
                <div>
                  <strong>{application.name}</strong>
                  <span className={`confidence ${application.confidence}`}>{application.confidence} confidence</span>
                </div>
                <p>{application.signal}</p>
              </div>
            )) : <p className="detector-signal">Start monitoring, then join a Teams or Zoom call.</p>}
          </div>
          <div className="row-actions">
            <button className="primary" disabled={busy || enabled} onClick={() => void setDetectionRunning(true)}>
              {busy ? "Please wait…" : "Enable Detection"}
            </button>
            <button className="secondary" disabled={busy || !enabled} onClick={() => void setDetectionRunning(false)}>
              Disable
            </button>
          </div>
        </section>

        <section className="detector-card">
          <h2>Detected events</h2>
          {events.length === 0 ? (
            <p className="empty-events">No transitions detected in this session.</p>
          ) : (
            <div className="event-list">
              {events.map((record) => (
                <div className="event-row" key={record.id}>
                  <strong>{record.event === "meeting_started" ? "Meeting Started" : "Meeting Ended"}</strong>
                  <span>{record.occurredAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="diagnostic-note">
        <strong>Detection scope</strong>
        <p>Automatic meeting tracking currently supports the Teams and Zoom desktop applications. Browser-based meetings are ignored.</p>
      </div>

      <section className="detector-card notification-settings">
        <div className="detector-heading">
          <div>
            <h2>Native notifications</h2>
            <p>Show a system notification when timers start or stop and when a detected meeting needs a customer.</p>
          </div>
          <span className={`status-pill ${notificationsEnabled ? "" : "inactive"}`}>
            {notificationsEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <button className={notificationsEnabled ? "secondary" : "primary"} disabled={busy} onClick={() => void toggleNotifications()}>
          {notificationsEnabled ? "Disable Notifications" : "Enable Notifications"}
        </button>
      </section>
    </section>
  );
}
