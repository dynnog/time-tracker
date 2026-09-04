import { getDatabase } from "./database";
import type { Activity } from "../types";

export async function listActivities(includeInactive = false): Promise<Activity[]> {
  const db = await getDatabase();
  const where = includeInactive ? "" : "WHERE active = 1";
  return db.select<Activity[]>(`SELECT * FROM activities ${where} ORDER BY id`);
}
