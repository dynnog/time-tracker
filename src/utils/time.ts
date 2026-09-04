export function elapsedSeconds(startIso: string, nowMs = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - new Date(startIso).getTime()) / 1000));
}

export function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatHoursMinutes(seconds: number): string {
  const hours = Math.floor(Math.max(0, seconds) / 3600);
  const minutes = Math.floor((Math.max(0, seconds) % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatStartTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function durationSeconds(startIso: string, endIso: string): number {
  return Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
}

export function requireEndAfterStart(startIso: string, endIso: string): number {
  const seconds = durationSeconds(startIso, endIso);
  if (seconds <= 0) throw new Error("End time must be after start time.");
  return seconds;
}

export function localDateKey(iso: string): string {
  return formatLocalDate(new Date(iso));
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalDateInput(iso: string): string {
  return localDateKey(iso);
}

export function toLocalTimeInput(iso: string): string {
  const date = new Date(iso);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function fromLocalDateAndTime(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const timeParts = time.split(":").map(Number);
  const hours = timeParts[0] ?? 0;
  const minutes = timeParts[1] ?? 0;
  const seconds = timeParts[2] ?? 0;
  return new Date(year, month - 1, day, hours, minutes, seconds, 0).toISOString();
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeekMonday(reference = new Date()): Date {
  const local = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const day = local.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + offset);
  return local;
}

export function weekUtcIsoBounds(weekStartLocal: Date): { startIso: string; endIso: string } {
  const start = new Date(weekStartLocal.getFullYear(), weekStartLocal.getMonth(), weekStartLocal.getDate());
  const end = addDays(start, 7);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function formatWeekLabel(weekStartLocal: Date, locale?: string): string {
  const weekEnd = addDays(weekStartLocal, 6);
  const startLabel = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(weekStartLocal);
  const endLabel = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(weekEnd);
  return `${startLabel} – ${endLabel}`;
}

export function formatDayHeading(dateKey: string, locale?: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date).toUpperCase();
  const rest = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(date).toUpperCase();
  return `${weekday} — ${rest}`;
}

export function combineEntryRange(
  date: string,
  startTime: string,
  endTime: string,
  allowNextDayEnd: boolean,
): { startIso: string; endIso: string; durationSeconds: number } {
  const startIso = fromLocalDateAndTime(date, startTime);
  let endIso = fromLocalDateAndTime(date, endTime);
  if (new Date(endIso).getTime() <= new Date(startIso).getTime() && allowNextDayEnd) {
    const [year, month, day] = date.split("-").map(Number);
    const nextDate = formatLocalDate(addDays(new Date(year, month - 1, day), 1));
    endIso = fromLocalDateAndTime(nextDate, endTime);
  }
  return { startIso, endIso, durationSeconds: requireEndAfterStart(startIso, endIso) };
}
