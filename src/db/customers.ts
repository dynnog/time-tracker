import { getDatabase } from "./database";
import type { Customer } from "../types";

export async function listCustomers(includeArchived = false): Promise<Customer[]> {
  const db = await getDatabase();
  const where = includeArchived ? "" : "WHERE active = 1";
  return db.select<Customer[]>(`SELECT * FROM customers ${where} ORDER BY name COLLATE NOCASE`);
}

export async function createCustomer(name: string, notes: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO customers (name, active, notes, created_at, updated_at) VALUES (?, 1, ?, ?, ?)",
    [name.trim(), notes.trim() || null, now, now],
  );
}

export async function updateCustomer(id: number, name: string, notes: string, active: boolean): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "UPDATE customers SET name = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?",
    [name.trim(), notes.trim() || null, active ? 1 : 0, new Date().toISOString(), id],
  );
}

export async function archiveCustomer(id: number): Promise<void> {
  const db = await getDatabase();
  await db.execute("UPDATE customers SET active = 0, updated_at = ? WHERE id = ?", [new Date().toISOString(), id]);
}
