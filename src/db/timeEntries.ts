import { getDatabase } from "./database";
import type { RunningTimer, TimeEntry, TimeEntryUpdate, TimerStartInput } from "../types";
import { requireEndAfterStart } from "../utils/time";

export async function getRunningTimer(): Promise<RunningTimer | null> {
  const db = await getDatabase();
  const rows = await db.select<RunningTimer[]>(`
    SELECT te.id, te.customer_id, c.name AS customer_name, te.activity_id,
           COALESCE(a.name, te.activity_name) AS activity_name,
           te.start_time, te.notes, te.source
    FROM time_entries te
    JOIN customers c ON c.id = te.customer_id
    LEFT JOIN activities a ON a.id = te.activity_id
    WHERE te.end_time IS NULL
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function startTimer(input: TimerStartInput): Promise<RunningTimer> {
  const existing = await getRunningTimer();
  if (existing) throw new Error("A timer is already running.");

  const db = await getDatabase();
  const activities = await db.select<{ name: string }[]>("SELECT name FROM activities WHERE id = ?", [input.activityId]);
  const activityName = activities[0]?.name;
  if (!activityName) throw new Error("Select a valid activity.");

  const now = new Date().toISOString();
  try {
    await db.execute(
      `INSERT INTO time_entries
       (customer_id, activity_id, activity_name, start_time, end_time, duration_seconds, notes, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 'manual', ?, ?)`,
      [input.customerId, input.activityId, activityName, now, input.notes?.trim() || null, now, now],
    );
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new Error("A timer is already running.");
    throw error;
  }

  const timer = await getRunningTimer();
  if (!timer) throw new Error("Timer was started but could not be reloaded.");
  return timer;
}

export async function stopTimer(): Promise<void> {
  const current = await getRunningTimer();
  if (!current) throw new Error("There is no running timer to stop.");

  const end = new Date();
  const duration = Math.max(0, Math.floor((end.getTime() - new Date(current.start_time).getTime()) / 1000));
  const db = await getDatabase();
  await db.execute(
    "UPDATE time_entries SET end_time = ?, duration_seconds = ?, updated_at = ? WHERE id = ? AND end_time IS NULL",
    [end.toISOString(), duration, end.toISOString(), current.id],
  );
}

const ENTRY_SELECT = `
  SELECT te.id, te.customer_id, c.name AS customer_name, c.active AS customer_active,
         te.activity_id, COALESCE(a.name, te.activity_name, '') AS activity_name,
         te.start_time, te.end_time, te.duration_seconds, te.notes, te.source
  FROM time_entries te
  JOIN customers c ON c.id = te.customer_id
  LEFT JOIN activities a ON a.id = te.activity_id
`;

export async function listCompletedEntries(startIso: string, endIso: string): Promise<TimeEntry[]> {
  const db = await getDatabase();
  return db.select<TimeEntry[]>(
    `${ENTRY_SELECT}
     WHERE te.end_time IS NOT NULL
       AND te.start_time >= ?
       AND te.start_time < ?
     ORDER BY te.start_time ASC, te.id ASC`,
    [startIso, endIso],
  );
}

export async function updateTimeEntry(id: number, update: TimeEntryUpdate): Promise<void> {
  const duration = requireEndAfterStart(update.startTime, update.endTime);
  const db = await getDatabase();
  const activities = await db.select<{ name: string }[]>("SELECT name FROM activities WHERE id = ?", [update.activityId]);
  const activityName = activities[0]?.name;
  if (!activityName) throw new Error("Select a valid activity.");

  const result = await db.execute(
    `UPDATE time_entries
     SET customer_id = ?, activity_id = ?, activity_name = ?, start_time = ?, end_time = ?,
         duration_seconds = ?, notes = ?, updated_at = ?
     WHERE id = ? AND end_time IS NOT NULL`,
    [
      update.customerId,
      update.activityId,
      activityName,
      update.startTime,
      update.endTime,
      duration,
      update.notes.trim() || null,
      new Date().toISOString(),
      id,
    ],
  );
  if (result.rowsAffected === 0) throw new Error("That time entry could not be updated.");
}

export async function deleteTimeEntry(id: number): Promise<void> {
  const db = await getDatabase();
  const result = await db.execute("DELETE FROM time_entries WHERE id = ? AND end_time IS NOT NULL", [id]);
  if (result.rowsAffected === 0) throw new Error("That time entry could not be deleted.");
}
