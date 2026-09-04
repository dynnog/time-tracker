import type { TimeEntry } from "../types";

export function getWeeklyTotal(entries: TimeEntry[]): number {
  return entries.reduce(
    (total, entry) => total + (entry.duration_seconds ?? 0),
    0
  );
}

export function getCustomerTotals(entries: TimeEntry[]) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const customerName =
      entry.customer_name ?? "Unknown Customer";

    totals.set(
      customerName,
      (totals.get(customerName) ?? 0) +
        (entry.duration_seconds ?? 0)
    );
  }

  return Array.from(totals.entries())
    .map(([customer, durationSeconds]) => ({
      customer,
      durationSeconds,
    }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);
}

export function getDailyTotals(entries: TimeEntry[]) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const date = new Date(entry.start_time);

    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    totals.set(
      dateKey,
      (totals.get(dateKey) ?? 0) +
        (entry.duration_seconds ?? 0)
    );
  }

  return Array.from(totals.entries())
    .map(([date, durationSeconds]) => ({
      date,
      durationSeconds,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}