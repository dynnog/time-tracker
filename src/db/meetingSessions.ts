import type { DetectedMeetingApplication } from "../services/meetingService";
import type { MeetingEntryInput, MeetingSession } from "../types";
import { getDatabase } from "./database";

export async function getActiveMeetingSession(): Promise<MeetingSession | null> {
  const db = await getDatabase();
  const rows = await db.select<MeetingSession[]>(
    "SELECT id, application_id, application_name, source, start_time, end_time, duration_seconds FROM meeting_sessions WHERE end_time IS NULL ORDER BY id LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function getPendingMeetingSession(): Promise<MeetingSession | null> {
  const db = await getDatabase();
  const rows = await db.select<MeetingSession[]>(
    "SELECT id, application_id, application_name, source, start_time, end_time, duration_seconds FROM meeting_sessions WHERE end_time IS NOT NULL ORDER BY start_time LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function beginMeetingSession(application: DetectedMeetingApplication): Promise<MeetingSession> {
  const existing = await getActiveMeetingSession();
  if (existing) return existing;
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO meeting_sessions
     (application_id, application_name, source, start_time, end_time, duration_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
    [application.id, application.name, application.id, now, now, now],
  );
  const session = await getActiveMeetingSession();
  if (!session) throw new Error("Meeting tracking started but could not be reloaded.");
  return session;
}

export async function completeActiveMeetingSession(): Promise<MeetingSession | null> {
  const current = await getActiveMeetingSession();
  if (!current) return getPendingMeetingSession();
  const end = new Date();
  const duration = Math.max(0, Math.floor((end.getTime() - new Date(current.start_time).getTime()) / 1000));
  const db = await getDatabase();
  await db.execute(
    "UPDATE meeting_sessions SET end_time = ?, duration_seconds = ?, updated_at = ? WHERE id = ? AND end_time IS NULL",
    [end.toISOString(), duration, end.toISOString(), current.id],
  );
  return getPendingMeetingSession();
}

export async function saveMeetingSession(session: MeetingSession, input: MeetingEntryInput): Promise<void> {
  if (!session.end_time || session.duration_seconds === null) throw new Error("The meeting has not ended.");
  const db = await getDatabase();
  const activities = await db.select<{ name: string }[]>("SELECT name FROM activities WHERE id = ?", [input.activityId]);
  const activityName = activities[0]?.name;
  if (!activityName) throw new Error("Select a valid activity.");
  const now = new Date().toISOString();

  await db.execute("BEGIN IMMEDIATE");
  try {
    await db.execute(
      `INSERT INTO time_entries
       (customer_id, activity_id, activity_name, start_time, end_time, duration_seconds, notes, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.customerId, input.activityId, activityName, session.start_time, session.end_time,
        session.duration_seconds, input.notes.trim() || null, session.source, now, now],
    );
    await db.execute("DELETE FROM meeting_sessions WHERE id = ?", [session.id]);
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function discardMeetingSession(id: number): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM meeting_sessions WHERE id = ? AND end_time IS NOT NULL", [id]);
}
