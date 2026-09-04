import { useEffect, useMemo, useState } from "react";
import { listActivities } from "../db/activities";
import { listCustomers } from "../db/customers";
import { deleteTimeEntry, listCompletedEntries, updateTimeEntry } from "../db/timeEntries";
import type { Activity, Customer, TimeEntry } from "../types";
import {
  addDays,
  combineEntryRange,
  formatDayHeading,
  formatHoursMinutes,
  formatLocalDate,
  formatStartTime,
  formatWeekLabel,
  localDateKey,
  startOfWeekMonday,
  toLocalDateInput,
  toLocalTimeInput,
  weekUtcIsoBounds,
  formatDurationSeconds
} from "../utils/time";
import {
  getWeeklyTotal,
  getCustomerTotals,
  getDailyTotals,
} from "../services/reportingService";
import { createDetailedCsv, createSummaryCsv, saveCsvFile } from "../services/exportService";

interface DayGroup {
  dateKey: string;
  entries: TimeEntry[];
  totalSeconds: number;
}

interface EditorState {
  entry: TimeEntry;
  customerId: string;
  activityId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  allowNextDayEnd: boolean;
}

function buildWeekDays(weekStart: Date, entries: TimeEntry[]): DayGroup[] {
  const byDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = localDateKey(entry.start_time);
    const list = byDate.get(key) ?? [];
    list.push(entry);
    byDate.set(key, list);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const dateKey = formatLocalDate(day);
    const dayEntries = byDate.get(dateKey) ?? [];
    return {
      dateKey,
      entries: dayEntries,
      totalSeconds: dayEntries.reduce((sum, entry) => sum + entry.duration_seconds, 0),
    };
  });
}

function openEditor(entry: TimeEntry): EditorState {
  return {
    entry,
    customerId: String(entry.customer_id),
    activityId: entry.activity_id ? String(entry.activity_id) : "",
    date: toLocalDateInput(entry.start_time),
    startTime: toLocalTimeInput(entry.start_time),
    endTime: toLocalTimeInput(entry.end_time),
    notes: entry.notes ?? "",
    allowNextDayEnd: localDateKey(entry.start_time) !== localDateKey(entry.end_time),
  };
}

export function TimesheetPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TimeEntry | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"detailed" | "summary" | "excel" | null>(null);
  const [notice, setNotice] = useState("");

  async function reload(start = weekStart) {
    const bounds = weekUtcIsoBounds(start);
    const [entryRows, customerRows, activityRows] = await Promise.all([
      listCompletedEntries(bounds.startIso, bounds.endIso),
      listCustomers(true),
      listActivities(true),
    ]);
    setEntries(entryRows);
    setCustomers(customerRows);
    setActivities(activityRows);
  }

  useEffect(() => {
    setError("");
    void reload(weekStart).catch((e) => setError(String(e)));
  }, [weekStart]);

  useEffect(() => {
    const refresh = () => void reload().catch((e) => setError(String(e)));
    window.addEventListener("time-entry-changed", refresh);
    return () => window.removeEventListener("time-entry-changed", refresh);
  }, [weekStart]);

  const days = useMemo(() => buildWeekDays(weekStart, entries), [weekStart, entries]);

  const weeklyTotal = getWeeklyTotal(entries);
  const customerTotals = getCustomerTotals(entries);
  const dailyTotals = getDailyTotals(entries);

  const editorActivities = useMemo(() => {
    if (!editor) return activities;
    if (!editor.activityId || activities.some((activity) => String(activity.id) === editor.activityId)) return activities;
    return [{ id: Number(editor.activityId), name: editor.entry.activity_name, active: 0 }, ...activities];
  }, [activities, editor]);

  function moveWeek(offset: number) {
    setWeekStart((current) => addDays(current, offset * 7));
    setEditor(null);
    setPendingDelete(null);
  }

  async function saveEditor() {
    if (!editor || !editor.customerId || !editor.activityId) {
      setError("Customer and activity are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const range = combineEntryRange(editor.date, editor.startTime, editor.endTime, editor.allowNextDayEnd);
      await updateTimeEntry(editor.entry.id, {
        customerId: Number(editor.customerId),
        activityId: Number(editor.activityId),
        startTime: range.startIso,
        endTime: range.endIso,
        notes: editor.notes,
      });
      setEditor(null);
      const nextWeek = startOfWeekMonday(new Date(range.startIso));
      if (formatLocalDate(nextWeek) === formatLocalDate(weekStart)) await reload();
      else setWeekStart(nextWeek);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await deleteTimeEntry(pendingDelete.id);
      if (editor?.entry.id === pendingDelete.id) setEditor(null);
      setPendingDelete(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(kind: "detailed" | "summary") {
    setExporting(kind);
    setError("");
    setNotice("");
    try {
      const week = formatLocalDate(weekStart);
      const detailed = kind === "detailed";
      const saved = await saveCsvFile(
        detailed ? createDetailedCsv(entries) : createSummaryCsv(entries),
        `time-tracker-${week}-${detailed ? "detailed" : "summary"}.csv`,
      );
      if (saved) setNotice(`${detailed ? "Detailed" : "Summary"} CSV exported successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  }

  async function exportExcel() {
    setExporting("excel");
    setError("");
    setNotice("");
    try {
      const { saveExcelFile } = await import("../services/excelExportService");
      const saved = await saveExcelFile(entries, `time-tracker-${formatLocalDate(weekStart)}.xlsx`);
      if (saved) setNotice("Excel workbook exported successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  }

  const previewDuration = (() => {
    if (!editor) return null;
    try {
      return formatHoursMinutes(combineEntryRange(editor.date, editor.startTime, editor.endTime, editor.allowNextDayEnd).durationSeconds);
    } catch {
      return null;
    }
  })();

  return (
    <section className="page">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>Timesheet</h1>
          <p>Review completed work for the selected week. Running timers stay on the Timer screen until they are stopped.</p>
        </div>
        <div className="export-actions">
          <button className="secondary" onClick={() => void exportCsv("detailed")} disabled={exporting !== null}>
            {exporting === "detailed" ? "Exporting…" : "Export Detailed CSV"}
          </button>
          <button className="secondary" onClick={() => void exportCsv("summary")} disabled={exporting !== null}>
            {exporting === "summary" ? "Exporting…" : "Export Summary CSV"}
          </button>
          <button className="secondary" onClick={() => void exportExcel()} disabled={exporting !== null}>
            {exporting === "excel" ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </header>

      <div className="week-nav">
        <button className="secondary" onClick={() => moveWeek(-1)}>Previous Week</button>
        <h2>{formatWeekLabel(weekStart)}</h2>
        <button className="secondary" onClick={() => moveWeek(1)}>Next Week</button>
      </div>

      <section className="timesheet-summary">
        <div className="summary-card weekly-total">
          <span>Weekly Total</span>
          <strong>{formatDurationSeconds(weeklyTotal)}</strong>
        </div>

        <div className="summary-card">
          <h3>By Customer</h3>

          {customerTotals.length === 0 ? (
            <p>No tracked time this week.</p>
          ) : (
            customerTotals.map((item) => (
              <div key={item.customer} className="summary-row">
                <span>{item.customer}</span>
                <strong>{formatDurationSeconds(item.durationSeconds)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="summary-card">
          <h3>Daily Totals</h3>

          {dailyTotals.map((item) => (
            <div key={item.date} className="summary-row">
              <span>
                {new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                })}
              </span>

              <strong>{formatDurationSeconds(item.durationSeconds)}</strong>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="timesheet-layout">
        <div className="day-list">
          {days.map((day) => (
            <section className="day-group" key={day.dateKey}>
              <header className="day-heading">
                <h3>{formatDayHeading(day.dateKey)}</h3>
                <span>{formatHoursMinutes(day.totalSeconds)}</span>
              </header>
              {day.entries.length === 0 ? (
                <div className="empty-day">No entries</div>
              ) : day.entries.map((entry) => (
                <article className="entry-row" key={entry.id}>
                  <div>
                    <strong>{entry.customer_name}</strong>
                    {entry.customer_active === 0 && <span className="archived-tag">Archived</span>}
                    <p className="activity-name">{entry.activity_name}</p>
                    <p className="entry-range">
                      {formatStartTime(entry.start_time)} – {formatStartTime(entry.end_time)}
                      {" · "}
                      {formatHoursMinutes(entry.duration_seconds)}
                    </p>
                    {entry.notes && <p className="entry-notes">{entry.notes}</p>}
                  </div>
                  <div className="row-actions">
                    <button className="secondary" onClick={() => { setPendingDelete(null); setEditor(openEditor(entry)); }}>Edit</button>
                    <button className="ghost" onClick={() => { setEditor(null); setPendingDelete(entry); }}>Delete</button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>

        {editor && (
          <aside className="editor-card">
            <h2>Edit entry</h2>
            <label>Customer
              <select value={editor.customerId} onChange={(e) => setEditor({ ...editor, customerId: e.target.value })}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}{customer.active === 0 ? " (archived)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>Activity
              <select value={editor.activityId} onChange={(e) => setEditor({ ...editor, activityId: e.target.value })}>
                {editorActivities.map((activity) => (
                  <option key={activity.id} value={activity.id}>{activity.name}</option>
                ))}
              </select>
            </label>
            <label>Date
              <input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} />
            </label>
            <div className="time-fields">
              <label>Start time
                <input type="time" step={1} value={editor.startTime} onChange={(e) => setEditor({ ...editor, startTime: e.target.value })} />
              </label>
              <label>End time
                <input type="time" step={1} value={editor.endTime} onChange={(e) => setEditor({ ...editor, endTime: e.target.value })} />
              </label>
            </div>
            {editor.allowNextDayEnd && <p className="hint left">This entry ends the next calendar day.</p>}
            <p className="duration-preview">Duration {previewDuration ?? "invalid range"}</p>
            <label>Notes <span className="optional">Optional</span>
              <textarea rows={4} value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} />
            </label>
            <button className="primary" onClick={() => void saveEditor()} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
            <button className="ghost full" onClick={() => setEditor(null)}>Cancel</button>
          </aside>
        )}
      </div>

      {pendingDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="modal-card">
            <h2 id="delete-title">Delete this time entry?</h2>
            <p className="modal-customer">{pendingDelete.customer_name}</p>
            <p>{pendingDelete.activity_name}</p>
            <p>
              {formatStartTime(pendingDelete.start_time)} – {formatStartTime(pendingDelete.end_time)}
              {" · "}
              {formatHoursMinutes(pendingDelete.duration_seconds)}
            </p>
            <p>This cannot be undone.</p>
            <div className="row-actions">
              <button className="primary danger" onClick={() => void confirmDelete()} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
              <button className="secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
