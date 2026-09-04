import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { TimeEntry } from "../types";
import { localDateKey } from "../utils/time";

const UTF8_BOM = "\uFEFF";

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: Array<Array<string | number>>): string {
  return UTF8_BOM + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function localDate(iso: string): string {
  const date = new Date(iso);
  return [date.getMonth() + 1, date.getDate(), date.getFullYear()]
    .map((part, index) => (index < 2 ? String(part).padStart(2, "0") : String(part)))
    .join("/");
}

function localTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function durationClock(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function decimalHours(seconds: number): string {
  return (Math.max(0, seconds) / 3600).toFixed(2);
}

function displaySource(source: string): string {
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : "";
}

export function createDetailedCsv(entries: TimeEntry[]): string {
  const rows: Array<Array<string | number>> = [[
    "Date", "Customer", "Activity", "Start Time", "End Time",
    "Duration", "Duration Hours", "Notes", "Source",
  ]];

  for (const entry of entries) {
    rows.push([
      localDate(entry.start_time),
      entry.customer_name,
      entry.activity_name,
      localTime(entry.start_time),
      localTime(entry.end_time),
      durationClock(entry.duration_seconds),
      decimalHours(entry.duration_seconds),
      entry.notes ?? "",
      displaySource(entry.source),
    ]);
  }

  return csv(rows);
}

export function createSummaryCsv(entries: TimeEntry[]): string {
  const totals = new Map<string, { date: string; customer: string; seconds: number }>();

  for (const entry of entries) {
    const dateKey = localDateKey(entry.start_time);
    const key = JSON.stringify([dateKey, entry.customer_name]);
    const total = totals.get(key) ?? {
      date: localDate(entry.start_time),
      customer: entry.customer_name,
      seconds: 0,
    };
    total.seconds += entry.duration_seconds;
    totals.set(key, total);
  }

  const rows: Array<Array<string | number>> = [["Date", "Customer", "Total Hours"]];
  for (const total of totals.values()) {
    rows.push([total.date, total.customer, decimalHours(total.seconds)]);
  }
  return csv(rows);
}

export async function saveCsvFile(contents: string, defaultPath: string): Promise<boolean> {
  const path = await save({
    defaultPath,
    filters: [{ name: "CSV file", extensions: ["csv"] }],
  });
  if (!path) return false;
  await writeTextFile(path, contents);
  return true;
}
