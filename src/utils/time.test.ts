import { describe, expect, it } from "vitest";
import {
  addDays,
  combineEntryRange,
  durationSeconds,
  elapsedSeconds,
  formatDayHeading,
  formatElapsed,
  formatHoursMinutes,
  formatWeekLabel,
  localDateKey,
  requireEndAfterStart,
  startOfWeekMonday,
  weekUtcIsoBounds,
} from "./time";

describe("time calculations", () => {
  it("calculates one hour", () => expect(durationSeconds("2026-09-01T09:00:00Z", "2026-09-01T10:00:00Z")).toBe(3600));
  it("calculates 09:15 to 11:45", () => expect(durationSeconds("2026-09-01T09:15:00Z", "2026-09-01T11:45:00Z")).toBe(9000));
  it("handles crossing midnight", () => expect(durationSeconds("2026-09-01T23:30:00Z", "2026-09-02T00:30:00Z")).toBe(3600));
  it("uses UTC elapsed time across a DST-style clock skip", () => {
    expect(durationSeconds("2026-03-08T09:30:00.000Z", "2026-03-08T10:30:00.000Z")).toBe(3600);
  });
  it("derives elapsed time from timestamps", () => expect(elapsedSeconds("2026-09-01T10:00:00Z", Date.parse("2026-09-01T10:01:15Z"))).toBe(75));
  it("formats elapsed time", () => expect(formatElapsed(3727)).toBe("01:02:07"));
  it("formats compact hours and minutes", () => expect(formatHoursMinutes(3727)).toBe("1h 02m"));
  it("rejects end times that are not after start", () => {
    expect(() => requireEndAfterStart("2026-09-01T10:00:00Z", "2026-09-01T10:00:00Z")).toThrow("End time must be after start time.");
    expect(() => requireEndAfterStart("2026-09-01T11:00:00Z", "2026-09-01T10:00:00Z")).toThrow("End time must be after start time.");
  });
});

describe("local week boundaries", () => {
  it("starts the week on Monday for a midweek date", () => {
    const wednesday = new Date(2026, 8, 2);
    const start = startOfWeekMonday(wednesday);
    expect(start.getDay()).toBe(1);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(31);
  });

  it("keeps Sunday in the current Monday-Sunday week", () => {
    const sunday = new Date(2026, 8, 6);
    const start = startOfWeekMonday(sunday);
    expect(start.getDate()).toBe(31);
    expect(start.getMonth()).toBe(7);
    expect(addDays(start, 6).getDay()).toBe(0);
    expect(addDays(start, 6).getDate()).toBe(6);
  });

  it("formats the week label with local dates", () => {
    const start = startOfWeekMonday(new Date(2026, 8, 4));
    expect(formatWeekLabel(start, "en-US")).toBe("August 31 – September 6");
  });

  it("converts the local week to UTC ISO bounds covering seven local days", () => {
    const start = startOfWeekMonday(new Date(2026, 8, 4));
    const bounds = weekUtcIsoBounds(start);
    expect(new Date(bounds.startIso).getTime()).toBe(start.getTime());
    expect(new Date(bounds.endIso).getTime()).toBe(addDays(start, 7).getTime());
  });

  it("groups by the local calendar date of a UTC timestamp", () => {
    const localEvening = new Date(2026, 8, 1, 23, 30, 0).toISOString();
    expect(localDateKey(localEvening)).toBe("2026-09-01");
  });

  it("formats a day heading", () => {
    expect(formatDayHeading("2026-09-01", "en-US")).toBe("TUESDAY — SEPTEMBER 1");
  });
});

describe("local edit range", () => {
  it("recalculates duration from local date and times", () => {
    const range = combineEntryRange("2026-09-01", "09:00:00", "10:02:00", false);
    expect(range.durationSeconds).toBe(62 * 60);
  });

  it("preserves overnight entries when allowed", () => {
    const range = combineEntryRange("2026-09-01", "23:30:00", "00:30:00", true);
    expect(range.durationSeconds).toBe(3600);
  });

  it("rejects inverted same-day times", () => {
    expect(() => combineEntryRange("2026-09-01", "10:00:00", "09:00:00", false)).toThrow("End time must be after start time.");
  });
});
