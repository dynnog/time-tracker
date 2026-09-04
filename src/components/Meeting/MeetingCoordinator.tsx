import { useEffect, useRef, useState } from "react";
import { listActivities } from "../../db/activities";
import { listCustomers } from "../../db/customers";
import {
  beginMeetingSession,
  completeActiveMeetingSession,
  discardMeetingSession,
  getActiveMeetingSession,
  getPendingMeetingSession,
  saveMeetingSession,
} from "../../db/meetingSessions";
import { getRunningTimer, stopTimer } from "../../db/timeEntries";
import {
  isMeetingDetectionEnabled,
  meetingDetector,
  type DetectedMeetingApplication,
  type MeetingEventContext,
} from "../../services/meetingService";
import type { Activity, Customer, MeetingSession, RunningTimer } from "../../types";
import { formatHoursMinutes, formatStartTime } from "../../utils/time";

interface MeetingCoordinatorProps {
  runningTimer: RunningTimer | null;
  onTimerChange: (timer: RunningTimer | null) => void;
}

interface MeetingConflict {
  application: DetectedMeetingApplication;
  timer: RunningTimer;
}

export function MeetingCoordinator({ runningTimer, onTimerChange }: MeetingCoordinatorProps) {
  const runningTimerRef = useRef(runningTimer);
  const ignoredUntilEnd = useRef(false);
  const [active, setActive] = useState<MeetingSession | null>(null);
  const [pending, setPending] = useState<MeetingSession | null>(null);
  const [conflict, setConflict] = useState<MeetingConflict | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { runningTimerRef.current = runningTimer; }, [runningTimer]);

  useEffect(() => {
    let mounted = true;

    async function startTracking(application: DetectedMeetingApplication) {
      if (ignoredUntilEnd.current) return;
      const existing = await getActiveMeetingSession();
      if (existing) {
        if (mounted) setActive(existing);
        return;
      }
      const currentTimer = await getRunningTimer();
      if (currentTimer) {
        runningTimerRef.current = currentTimer;
        if (mounted) setConflict({ application, timer: currentTimer });
        return;
      }
      const session = await beginMeetingSession(application);
      if (mounted) setActive(session);
    }

    async function meetingStarted(context: MeetingEventContext) {
      const application = context.applications.find((candidate) => candidate.confidence === "high");
      if (application) await startTracking(application);
    }

    async function meetingEnded() {
      ignoredUntilEnd.current = false;
      if (mounted) setConflict(null);
      const session = await completeActiveMeetingSession();
      if (mounted) {
        setActive(null);
        if (session) setPending(session);
      }
    }

    const reportError = (reason: unknown) => {
      if (mounted) setError(reason instanceof Error ? reason.message : String(reason));
    };
    const unsubscribeStarted = meetingDetector.onMeetingStarted((context) => void meetingStarted(context).catch(reportError));
    const unsubscribeEnded = meetingDetector.onMeetingEnded(() => void meetingEnded().catch(reportError));
    const preferenceChanged = (event: Event) => {
      const enabled = (event as CustomEvent<boolean>).detail;
      if (enabled) void meetingDetector.start().catch(reportError);
      else void meetingDetector.stop().then(() => meetingEnded()).catch(reportError);
    };
    window.addEventListener("meeting-detection-preference", preferenceChanged);

    void Promise.all([
      getActiveMeetingSession(),
      getPendingMeetingSession(),
      listCustomers(),
      listActivities(),
    ]).then(async ([activeSession, pendingSession, customerRows, activityRows]) => {
      if (!mounted) return;
      setActive(activeSession);
      setPending(pendingSession);
      setCustomers(customerRows);
      setActivities(activityRows);
      const customerMeeting = activityRows.find((activity) => activity.name === "Customer Meeting");
      setActivityId(String(customerMeeting?.id ?? activityRows[0]?.id ?? ""));
      if (isMeetingDetectionEnabled()) {
        await meetingDetector.start();
        if (activeSession && !meetingDetector.getStatus()?.detected) await meetingEnded();
      }
    }).catch(reportError);

    return () => {
      mounted = false;
      unsubscribeStarted();
      unsubscribeEnded();
      window.removeEventListener("meeting-detection-preference", preferenceChanged);
    };
  }, []);

  async function stopManualAndTrackMeeting() {
    if (!conflict) return;
    setBusy(true);
    setError("");
    try {
      await stopTimer();
      onTimerChange(null);
      const session = await beginMeetingSession(conflict.application);
      setActive(session);
      setConflict(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  function ignoreMeeting() {
    ignoredUntilEnd.current = true;
    setConflict(null);
  }

  async function savePending() {
    if (!pending || !customerId || !activityId) {
      setError("Customer and activity are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveMeetingSession(pending, {
        customerId: Number(customerId),
        activityId: Number(activityId),
        notes,
      });
      setPending(await getPendingMeetingSession());
      setCustomerId("");
      setNotes("");
      window.dispatchEvent(new Event("time-entry-changed"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function discardPending() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      await discardMeetingSession(pending.id);
      setPending(await getPendingMeetingSession());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {active && (
        <div className="meeting-banner">
          <span className="running-dot" />
          Tracking {active.application_name} meeting since {formatStartTime(active.start_time)}
        </div>
      )}
      {error && <div className="alert error coordinator-error">Meeting tracking: {error}</div>}

      {conflict && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="meeting-conflict-title">
          <div className="modal-card">
            <h2 id="meeting-conflict-title">A meeting has started.</h2>
            <p>Detected {conflict.application.name}. Your current timer is:</p>
            <p className="modal-customer">{conflict.timer.customer_name}</p>
            <p>{conflict.timer.activity_name}</p>
            <div className="row-actions">
              <button className="primary" disabled={busy} onClick={() => void stopManualAndTrackMeeting()}>
                {busy ? "Switching…" : "Stop current timer and track meeting"}
              </button>
              <button className="secondary" disabled={busy} onClick={ignoreMeeting}>Ignore meeting</button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="meeting-complete-title">
          <div className="modal-card meeting-complete-card">
            <h2 id="meeting-complete-title">Meeting Completed</h2>
            <p>{pending.application_name} · {formatHoursMinutes(pending.duration_seconds ?? 0)}</p>
            <label>Customer
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Select customer</option>
                {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label>Activity
              <select value={activityId} onChange={(event) => setActivityId(event.target.value)}>
                {activities.map((activity) => <option value={activity.id} key={activity.id}>{activity.name}</option>)}
              </select>
            </label>
            <label>Notes <span className="optional">Optional</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="row-actions">
              <button className="primary" disabled={busy} onClick={() => void savePending()}>{busy ? "Saving…" : "Save"}</button>
              <button className="ghost" disabled={busy} onClick={() => void discardPending()}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
