import { describe, expect, it } from "vitest";
import { escapeText, fold, toIcs } from "./ics";
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

describe("ics export", () => {
  it("writes events in the destination time zone with escaped text", () => {
    const ics = toIcs(trip, [ev({ aiReason: "Quiet early; go before 10.", location: "Asakusa, Tokyo" })], new Date("2026-11-14T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
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
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
});
