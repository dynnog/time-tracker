import { useEffect, useMemo, useState } from "react";
import { listActivities } from "../db/activities";
import { listCustomers } from "../db/customers";
import { getRunningTimer, startTimer, stopTimer } from "../db/timeEntries";
import type { Activity, Customer, RunningTimer } from "../types";
import { elapsedSeconds, formatElapsed, formatStartTime } from "../utils/time";

interface TimerPageProps {
  runningTimer: RunningTimer | null;
  onTimerChange: (timer: RunningTimer | null) => void;
}

export function TimerPage({ runningTimer, onTimerChange }: TimerPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [notes, setNotes] = useState("");
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [overlap, setOverlap] = useState<RunningTimer | null>(null);

  useEffect(() => {
    Promise.all([listCustomers(), listActivities()]).then(([customerRows, activityRows]) => {
      setCustomers(customerRows);
      setActivities(activityRows);
      if (activityRows.length > 0) setActivityId(String(activityRows[0].id));
    }).catch((e) => setError(String(e)));
  }, [runningTimer]);

  useEffect(() => {
    if (!runningTimer) return;
    setTick(Date.now());
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runningTimer]);

  const elapsed = useMemo(() => runningTimer ? elapsedSeconds(runningTimer.start_time, tick) : 0, [runningTimer, tick]);

  async function handleStart() {
    if (!customerId || !activityId) {
      setError("Select a customer and activity before starting the timer.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const existing = await getRunningTimer();
      if (existing) {
        onTimerChange(existing);
        setOverlap(existing);
        return;
      }
      const timer = await startTimer({ customerId: Number(customerId), activityId: Number(activityId), notes });
      onTimerChange(timer);
      setNotes("");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (message.toLowerCase().includes("already running")) {
        const existing = await getRunningTimer().catch(() => null);
        if (existing) {
          onTimerChange(existing);
          setOverlap(existing);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    setError("");
    try {
      await stopTimer();
      onTimerChange(null);
      setOverlap(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page narrow-page">
      <header className="page-header">
        <p className="eyebrow">Focus</p>
        <h1>{runningTimer ? "Time in progress" : "What are you working on?"}</h1>
        <p>{runningTimer ? "Your start time is saved locally. You can navigate away safely." : "Choose the work, then start. One timer at a time."}</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      {overlap && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="overlap-title">
          <div className="modal-card">
            <h2 id="overlap-title">A timer is already running.</h2>
            <p className="modal-customer">{overlap.customer_name}</p>
            <p className="activity-name">{overlap.activity_name}</p>
            <p>Started {formatStartTime(overlap.start_time)}</p>
            <div className="row-actions">
              <button className="primary danger" onClick={() => void handleStop()} disabled={busy}>Stop Current Timer</button>
              <button className="secondary" onClick={() => setOverlap(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {runningTimer ? (
        <div className="timer-card running-card">
          <div className="timer-meta">
            <span className="status-pill">Running</span>
            <span>Started {formatStartTime(runningTimer.start_time)}</span>
          </div>
          <h2>{runningTimer.customer_name}</h2>
          <p className="activity-name">{runningTimer.activity_name}</p>
          <div className="elapsed">{formatElapsed(elapsed)}</div>
          {runningTimer.notes && <p className="running-notes">{runningTimer.notes}</p>}
          <button className="primary danger" onClick={handleStop} disabled={busy}>{busy ? "Stopping…" : "Stop Timer"}</button>
        </div>
      ) : (
        <div className="timer-card">
          <label>Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label>Activity
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
            </select>
          </label>
          <label>Notes <span className="optional">Optional</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What are you working on?" />
          </label>
          <button className="primary" onClick={handleStart} disabled={busy || customers.length === 0}>{busy ? "Starting…" : "Start Timer"}</button>
          {customers.length === 0 && <p className="hint">Add an active customer before starting your first timer.</p>}
        </div>
      )}
    </section>
  );
}
