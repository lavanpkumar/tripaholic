// Date helpers. Calendar dates are "YYYY-MM-DD"; event times are floating local ISO ("YYYY-MM-DDTHH:mm:ss")
// in destination wall-clock time. We do arithmetic on them by treating them as UTC, which is DST-safe.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(s: string): boolean {
  if (!YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's date (YYYY-MM-DD) in the given IANA time zone. Falls back to UTC for unknown zones. */
export function todayIn(timeZone = "UTC", now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Parse a floating local ISO string to epoch-ms (treating wall-clock as UTC). NaN if invalid. */
export function parseLocal(s: string): number {
  if (typeof s !== "string") return NaN;
  // Accept "YYYY-MM-DDTHH:mm" / ":ss" / with fractional seconds; ignore any offset by stripping it.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return NaN;
  return Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}Z`);
}

export function toLocalIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

/** Normalise any accepted local-ish ISO string to "YYYY-MM-DDTHH:mm:ss". */
export function normalizeLocal(s: string): string | null {
  const ms = parseLocal(s);
  return Number.isNaN(ms) ? null : toLocalIso(ms);
}

export function localDate(s: string): string {
  return s.slice(0, 10);
}

export function at(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}`;
}

export function addMinutes(local: string, minutes: number): string {
  return toLocalIso(parseLocal(local) + minutes * 60_000);
}

export function minutesBetween(a: string, b: string): number {
  return Math.round((parseLocal(b) - parseLocal(a)) / 60_000);
}

/** Offset of `timeZone` from UTC in minutes at instant `date` (e.g. Asia/Tokyo -> 540). */
export function tzOffsetMinutes(timeZone: string, date: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - date.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/** Convert a floating local time in zone `from` to floating local time in zone `to`. */
export function convertLocal(local: string, from: string, to: string): string {
  const ms = parseLocal(local);
  const instant = new Date(ms - tzOffsetMinutes(from, new Date(ms)) * 60_000);
  return toLocalIso(instant.getTime() + tzOffsetMinutes(to, instant) * 60_000);
}

export function gmtLabel(timeZone: string, date: Date = new Date()): string {
  const off = tzOffsetMinutes(timeZone, date);
  const sign = off < 0 ? "-" : "+";
  const h = Math.floor(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** "8–15 Feb 2027", "28 Feb – 3 Mar 2027", "28 Dec 2026 – 2 Jan 2027" */
export function formatRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.d === b.d) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
}

export function formatDay(ymd: string): string {
  const { y, m, d } = parts(ymd);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthAbbr(ymd: string): string {
  return MONTHS[parts(ymd).m - 1].toUpperCase();
}

export function dayOfMonth(ymd: string): string {
  return String(parts(ymd).d).padStart(2, "0");
}

export function hhmm(local: string): string {
  return local.slice(11, 16);
}

export function tripLengthDays(start: string, end: string): number {
  return diffDays(start, end) + 1;
}
