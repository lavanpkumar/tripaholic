import { describe, expect, it } from "vitest";
import { escapeText, fold, toIcs, transitions } from "./ics";
import type { Trip, TripEvent } from "./types";

const trip = {
  id: "t1",
  title: "Tokyo, Spring",
  destination: { name: "Tokyo, Japan", scope: "city", timezone: "Asia/Tokyo" },
  startDate: "2027-04-01",
  endDate: "2027-04-04",
} as Trip;
const ev = (o: Partial<TripEvent>): TripEvent =>
  ({ id: "e1", tripId: "t1", title: "Senso-ji", start: "2027-04-01T09:00:00", end: "2027-04-01T11:00:00", source: "ai", createdAt: "", updatedAt: "", ...o }) as TripEvent;
const CRLF = "\r\n";
const lines = (...l: string[]) => l.join(CRLF);

describe("VTIMEZONE", () => {
  it("includes a VTIMEZONE matching every event TZID (no-DST zone)", () => {
    const ics = toIcs(trip, [ev({})]);
    expect(ics).toContain(lines("BEGIN:VTIMEZONE", "TZID:Asia/Tokyo"));
    expect(ics).toContain(lines("TZOFFSETFROM:+0900", "TZOFFSETTO:+0900"));
    expect(ics).not.toContain("BEGIN:DAYLIGHT");
    const declared = [...ics.matchAll(/^TZID:(.+)$/gm)].map((m) => m[1].trim());
    const used = [...ics.matchAll(/;TZID=([^:]+):/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const z of used) expect(declared).toContain(z);
  });

  it("encodes real DST transitions for New York", () => {
    const ny = { ...trip, destination: { ...trip.destination, timezone: "America/New_York" }, startDate: "2027-03-10", endDate: "2027-03-20" } as Trip;
    const ics = toIcs(ny, [ev({ start: "2027-03-15T09:00:00", end: "2027-03-15T10:00:00" })]);
    expect(ics).toContain(lines("BEGIN:DAYLIGHT", "DTSTART:20270314T020000", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "END:DAYLIGHT"));
    expect(ics).toContain(lines("BEGIN:STANDARD", "DTSTART:20271107T020000", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "END:STANDARD"));
    expect(ics).toContain("DTSTART;TZID=America/New_York:20270315T090000");
  });

  it("finds southern-hemisphere transitions and none for fixed zones", () => {
    const year = [Date.parse("2027-01-01T00:00:00Z"), Date.parse("2027-12-31T00:00:00Z")] as const;
    expect(transitions("Australia/Sydney", ...year).map((t) => [t.from, t.to])).toEqual([
      [660, 600],
      [600, 660],
    ]);
    expect(transitions("Asia/Kolkata", ...year)).toEqual([]);
  });
});

describe("ics export", () => {
  it("writes events in the destination time zone with escaped text", () => {
    const ics = toIcs(trip, [ev({ aiReason: "Quiet early; go before 10.", location: "Asakusa, Tokyo" })], new Date("2026-11-14T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR" + CRLF)).toBe(true);
    expect(ics).toContain("DTSTART;TZID=Asia/Tokyo:20270401T090000");
    expect(ics).toContain("DTEND;TZID=Asia/Tokyo:20270401T110000");
    expect(ics).toContain("X-WR-CALNAME:Tokyo\\, Spring");
    expect(ics).toContain("LOCATION:Asakusa\\, Tokyo");
    expect(ics).toContain("DESCRIPTION:Why: Quiet early\\; go before 10.");
    expect(ics).toContain("DTSTAMP:20261114T120000Z");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("escapes and folds long lines to 75 octets", () => {
    expect(escapeText("a,b;c\nd\\e")).toBe("a\\,b\\;c\\nd\\\\e");
    const folded = fold("DESCRIPTION:" + "x".repeat(200));
    for (const line of folded.split(CRLF)) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split(CRLF).slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
});
