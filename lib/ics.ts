import { tzOffsetMinutes } from "./dates";
import type { Trip, TripEvent } from "./types";

/**
 * iCalendar (RFC 5545) export. Event times are floating destination-local times, written with
 * TZID=<destination IANA zone> plus a matching VTIMEZONE (required by RFC 5545 §3.2.19, and what
 * Outlook needs), generated from the zone's real offsets via Intl.
 */

const DAY = 86_400_000;
const MINUTE = 60_000;

function fmtOffset(min: number): string {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}${String(a % 60).padStart(2, "0")}`;
}

/** "Local" wall time for an instant shifted by an offset, as YYYYMMDDTHHMMSS. */
function wallStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").slice(0, 15);
}

export interface Transition {
  /** UTC instant of the change */
  at: number;
  from: number;
  to: number;
}

/** Offset changes (DST and others) for `tz` between two UTC instants, to the minute. */
export function transitions(tz: string, startMs: number, endMs: number): Transition[] {
  const out: Transition[] = [];
  let prev = tzOffsetMinutes(tz, new Date(startMs));
  for (let t = startMs + DAY; t <= endMs; t += DAY) {
    const off = tzOffsetMinutes(tz, new Date(t));
    if (off === prev) continue;
    let lo = t - DAY;
    let hi = t;
    while (hi - lo > MINUTE) {
      const mid = lo + Math.floor((hi - lo) / 2 / MINUTE) * MINUTE;
      if (tzOffsetMinutes(tz, new Date(mid)) === prev) lo = mid;
      else hi = mid;
    }
    out.push({ at: hi, from: prev, to: off });
    prev = off;
  }
  return out;
}

/** VTIMEZONE covering the trip's years (plus one either side) with explicit observances. */
export function vtimezone(tz: string, fromYmd: string, toYmd: string): string[] {
  const start = Date.parse(`${Number(fromYmd.slice(0, 4)) - 1}-01-01T00:00:00Z`);
  const end = Date.parse(`${Number(toYmd.slice(0, 4)) + 1}-12-31T23:59:00Z`);
  const initial = tzOffsetMinutes(tz, new Date(start));
  const changes = transitions(tz, start, end);
  const standard = Math.min(initial, ...changes.map((c) => c.to));
  const block = (from: number, to: number, dtstart: string) => [
    `BEGIN:${to > standard ? "DAYLIGHT" : "STANDARD"}`,
    `DTSTART:${dtstart}`,
    `TZOFFSETFROM:${fmtOffset(from)}`,
    `TZOFFSETTO:${fmtOffset(to)}`,
    `END:${to > standard ? "DAYLIGHT" : "STANDARD"}`,
  ];
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    ...block(initial, initial, "19700101T000000"),
    // DTSTART of an observance is the local time it begins, in the offset in force before it.
    ...changes.flatMap((c) => block(c.from, c.to, wallStamp(c.at + c.from * MINUTE))),
    "END:VTIMEZONE",
  ];
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Fold lines longer than 75 octets (continuation lines start with a space). */
export function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

const stamp = (local: string) => local.replace(/[-:]/g, "").slice(0, 15); // 2027-02-08T09:00:00 -> 20270208T090000

export function toIcs(trip: Trip, events: TripEvent[], now = new Date()): string {
  const tz = trip.destination.timezone;
  const dtstamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tripaholic//Itinerary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(trip.title)}`,
    `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz, trip.startDate, trip.endDate),
  ];
  for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
    const description = [e.description, e.source === "ai" && e.aiReason ? `Why: ${e.aiReason}` : undefined, e.source === "booking" ? "From a booking (demo data)." : undefined]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@tripaholic`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${tz}:${stamp(e.start)}`,
      `DTEND;TZID=${tz}:${stamp(e.end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      `CATEGORIES:${e.source === "user" ? "Your event" : e.source === "booking" ? "Booking" : "AI suggestion"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
