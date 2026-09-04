import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { listActivities } from "../../db/activities";
import { listCustomers } from "../../db/customers";
import { startTimer } from "../../db/timeEntries";
import { notify } from "../../services/notificationService";
import type { Activity, Customer } from "../../types";

export function QuickStartWindow() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([listCustomers(), listActivities()])
      .then(([customerRows, activityRows]) => {
        setCustomers(customerRows);
        setActivities(activityRows);
        setActivityId(String(activityRows[0]?.id ?? ""));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  async function close() {
    await invoke("close_quick_start");
  }

  async function start() {
    if (!customerId || !activityId) {
      setError("Select a customer and activity.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const timer = await startTimer({ customerId: Number(customerId), activityId: Number(activityId), notes });
      await emit("quick-timer-started");
      void notify("Timer started", `${timer.customer_name} — ${timer.activity_name}`);
      await close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="quick-start-window">
      <header>
        <p className="eyebrow">Quick Start</p>
        <h1>Start a new timer</h1>
      </header>
      {error && <div className="alert error">{error}</div>}
      <label>Customer
        <select autoFocus value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          <option value="">Select customer</option>
          {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.favorite === 1 ? "★ " : ""}{customer.name}</option>)}
        </select>
      </label>
      <label>Activity
        <select value={activityId} onChange={(event) => setActivityId(event.target.value)}>
          {activities.map((activity) => <option value={activity.id} key={activity.id}>{activity.name}</option>)}
        </select>
      </label>
      <label>Notes <span className="optional">Optional</span>
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What are you working on?" />
      </label>
      <div className="quick-start-actions">
        <button className="secondary" disabled={busy} onClick={() => void close()}>Cancel</button>
        <button className="primary" disabled={busy || customers.length === 0} onClick={() => void start()}>{busy ? "Starting…" : "Start Timer"}</button>
      </div>
    </main>
  );
}
