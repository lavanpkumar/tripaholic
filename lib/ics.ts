import type { Trip, TripEvent } from "./types";

/**
 * iCalendar (RFC 5545) export. Event times are floating destination-local times, so they are
 * written with TZID=<destination IANA zone>, which Google, Apple, and Outlook calendars resolve.
 */

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
