import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { TimeEntry } from "../types";
import { createExcelFile, createExcelWorkbook } from "./excelExportService";

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 1,
    customer_id: 1,
    customer_name: "ARUI",
    customer_active: 1,
    activity_id: 1,
    activity_name: "Configuration",
    start_time: new Date(2026, 8, 1, 9, 0).toISOString(),
    end_time: new Date(2026, 8, 1, 10, 2).toISOString(),
    duration_seconds: 3720,
    notes: "Rating configuration",
    source: "manual",
    ...overrides,
  };
}

describe("Excel export", () => {
  it("creates the required sheets and typed detailed columns", () => {
    const workbook = createExcelWorkbook([entry()]);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Detailed Entries", "Weekly Summary"]);

    const sheet = workbook.getWorksheet("Detailed Entries")!;
    expect(sheet.getRow(1).values).toEqual([
      undefined, "Date", "Customer", "Activity", "Start", "End", "Duration", "Hours", "Notes", "Source",
    ]);
    expect(sheet.getCell("A2").value).toBeInstanceOf(Date);
    expect((sheet.getCell("A2").value as Date).getUTCHours()).toBe(0);
    expect(sheet.getCell("F2").value).toBeCloseTo(3720 / 86400);
    expect(sheet.getCell("G2").value).toBeCloseTo(3720 / 3600);
    expect(sheet.getCell("G2").numFmt).toBe("0.00");
  });

  it("aggregates summary hours before display rounding", () => {
    const workbook = createExcelWorkbook([
      entry({ id: 1, duration_seconds: 1810 }),
      entry({ id: 2, duration_seconds: 1810 }),
      entry({ id: 3, customer_name: "InsVista", duration_seconds: 8100 }),
    ]);
    const summary = workbook.getWorksheet("Weekly Summary")!;
    expect(summary.getCell("B2").value).toBe("ARUI");
    expect(summary.getCell("C2").value).toBeCloseTo(3620 / 3600);
    expect(summary.getCell("B3").value).toBe("InsVista");
    expect(summary.getCell("C3").value).toBe(2.25);
  });

  it("serializes a workbook that ExcelJS can reopen", async () => {
    const bytes = await createExcelFile([entry()]);
    expect(bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));

    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);
    expect(reopened.getWorksheet("Detailed Entries")?.rowCount).toBe(2);
    expect(reopened.getWorksheet("Weekly Summary")?.getCell("C2").value).toBeCloseTo(3720 / 3600);
  });
});
