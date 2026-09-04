import { describe, expect, it } from "vitest";
import type { TimeEntry } from "../types";
import { createDetailedCsv, createSummaryCsv } from "./exportService";

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  const start = new Date(2026, 8, 1, 9, 0).toISOString();
  const end = new Date(2026, 8, 1, 10, 2).toISOString();
  return {
    id: 1,
    customer_id: 1,
    customer_name: "ARUI",
    customer_active: 1,
    activity_id: 1,
    activity_name: "Customer Meeting",
    start_time: start,
    end_time: end,
    duration_seconds: 3720,
    notes: "Weekly implementation meeting",
    source: "manual",
    ...overrides,
  };
}

describe("CSV export", () => {
  it("creates detailed rows with local display values and decimal hours", () => {
    const result = createDetailedCsv([entry()]);
    expect(result).toContain("Date,Customer,Activity,Start Time,End Time,Duration,Duration Hours,Notes,Source\r\n");
    expect(result).toContain("09/01/2026,ARUI,Customer Meeting,9:00 AM,10:02 AM,01:02,1.03,Weekly implementation meeting,Manual\r\n");
  });

  it("escapes commas, quotes, and line breaks using CSV rules", () => {
    const result = createDetailedCsv([entry({
      customer_name: "Acme, Inc.",
      notes: "Discussed \"launch\"\nNext steps",
    })]);
    expect(result).toContain('"Acme, Inc."');
    expect(result).toContain('"Discussed ""launch""\nNext steps"');
  });

  it("aggregates summary rows by local date and customer before rounding", () => {
    const result = createSummaryCsv([
      entry({ id: 1, duration_seconds: 1810 }),
      entry({ id: 2, duration_seconds: 1810 }),
      entry({ id: 3, customer_name: "InsVista", duration_seconds: 8100 }),
    ]);
    expect(result).toContain("09/01/2026,ARUI,1.01\r\n");
    expect(result).toContain("09/01/2026,InsVista,2.25\r\n");
  });

  it("includes a UTF-8 BOM and headers for an empty export", () => {
    expect(createSummaryCsv([])).toBe("\uFEFFDate,Customer,Total Hours\r\n");
  });
});
