import ExcelJS from "exceljs";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { TimeEntry } from "../types";
import { localDateKey } from "../utils/time";

const HEADER_FILL = "243219";
const HEADER_TEXT = "FFFFFF";
const BORDER_COLOR = "D6DCD7";

function excelLocalDate(iso: string): Date {
  const local = new Date(iso);
  return new Date(Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
  ));
}

function excelLocalDateOnly(iso: string): Date {
  const local = new Date(iso);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

function displaySource(source: string): string {
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : "";
}

function styleSheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: sheet.getRow(1).getCell(widths.length).address };
  sheet.columns.forEach((column, index) => {
    column.width = widths[index];
    column.alignment = { vertical: "top", wrapText: index === widths.length - 2 };
  });

  const header = sheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: HEADER_TEXT } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { horizontal: "center", vertical: "middle" };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_COLOR } } };
  });
}

export function createExcelWorkbook(entries: TimeEntry[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Time Tracker";
  workbook.created = new Date();

  const details = workbook.addWorksheet("Detailed Entries", { properties: { defaultRowHeight: 18 } });
  details.addRow(["Date", "Customer", "Activity", "Start", "End", "Duration", "Hours", "Notes", "Source"]);
  for (const entry of entries) {
    details.addRow([
      excelLocalDateOnly(entry.start_time),
      entry.customer_name,
      entry.activity_name,
      excelLocalDate(entry.start_time),
      excelLocalDate(entry.end_time),
      entry.duration_seconds / 86400,
      entry.duration_seconds / 3600,
      entry.notes || null,
      displaySource(entry.source),
    ]);
  }
  details.getColumn(1).numFmt = "mm/dd/yyyy";
  details.getColumn(4).numFmt = "h:mm AM/PM";
  details.getColumn(5).numFmt = "h:mm AM/PM";
  details.getColumn(6).numFmt = "[h]:mm";
  details.getColumn(7).numFmt = "0.00";
  styleSheet(details, [12, 22, 22, 12, 12, 12, 11, 40, 12]);

  const totals = new Map<string, { date: Date; customer: string; seconds: number }>();
  for (const entry of entries) {
    const key = JSON.stringify([localDateKey(entry.start_time), entry.customer_name]);
    const total = totals.get(key) ?? {
      date: excelLocalDateOnly(entry.start_time),
      customer: entry.customer_name,
      seconds: 0,
    };
    total.seconds += entry.duration_seconds;
    totals.set(key, total);
  }

  const summary = workbook.addWorksheet("Weekly Summary", { properties: { defaultRowHeight: 18 } });
  summary.addRow(["Date", "Customer", "Total Hours"]);
  for (const total of totals.values()) {
    summary.addRow([total.date, total.customer, total.seconds / 3600]);
  }
  summary.getColumn(1).numFmt = "mm/dd/yyyy";
  summary.getColumn(3).numFmt = "0.00";
  styleSheet(summary, [12, 24, 14]);

  return workbook;
}

export async function createExcelFile(entries: TimeEntry[]): Promise<Uint8Array> {
  const buffer = await createExcelWorkbook(entries).xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function saveExcelFile(entries: TimeEntry[], defaultPath: string): Promise<boolean> {
  const path = await save({
    defaultPath,
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  });
  if (!path) return false;
  await writeFile(path, await createExcelFile(entries));
  return true;
}
