import { describe, expect, it } from "vitest";
import { MAX_TRIP_DAYS, dateRangeError, destinationSchema, eventCreateSchema, isValidTimeZone, tripCreateSchema, tripPatchSchema } from "./validation";

const trip = (over: Record<string, unknown> = {}) => ({
  title: "Tokyo Spring Trip",
  destination: { name: "Tokyo, Japan", scope: "city", timezone: "Asia/Tokyo" },
  startDate: "2027-04-01",
  endDate: "2027-04-04",
  ...over,
});

describe("dateRangeError", () => {
  it("accepts single-day and normal ranges", () => {
    expect(dateRangeError("2027-04-01", "2027-04-01")).toBeNull();
    expect(dateRangeError("2027-04-01", "2027-04-04")).toBeNull();
  });
  it("rejects an end before the start", () => {
    expect(dateRangeError("2027-04-04", "2027-04-01")).toMatch(/on or after/);
  });
  it(`allows exactly ${MAX_TRIP_DAYS} days and rejects one more`, () => {
    expect(dateRangeError("2027-04-01", "2027-04-30")).toBeNull(); // 30 days inclusive
    expect(dateRangeError("2027-04-01", "2027-05-01")).toMatch(/at most 30 days/);
  });
  it("counts across month and year boundaries", () => {
    expect(dateRangeError("2026-12-20", "2027-01-18")).toBeNull(); // 30 days
    expect(dateRangeError("2026-12-20", "2027-01-19")).not.toBeNull();
  });
});

describe("tripCreateSchema", () => {
  it("accepts a valid trip and trims the title", () => {
    const r = tripCreateSchema.parse(trip({ title: "  Tokyo  " }));
    expect(r.title).toBe("Tokyo");
  });
  it("requires a location, a title, and a known scope", () => {
    expect(tripCreateSchema.safeParse(trip({ title: " " })).success).toBe(false);
    expect(tripCreateSchema.safeParse(trip({ destination: { name: "", scope: "city", timezone: "Asia/Tokyo" } })).success).toBe(false);
    expect(tripCreateSchema.safeParse(trip({ destination: { name: "Tokyo", scope: "town", timezone: "Asia/Tokyo" } })).success).toBe(false);
    expect(tripCreateSchema.safeParse(trip({ destination: { name: "Tokyo", timezone: "Asia/Tokyo" } })).success).toBe(false);
  });
  it("rejects impossible dates and bad ranges on endDate", () => {
    expect(tripCreateSchema.safeParse(trip({ startDate: "2027-02-30" })).success).toBe(false);
    expect(tripCreateSchema.safeParse(trip({ startDate: "04/01/2027" })).success).toBe(false);
    const r = tripCreateSchema.safeParse(trip({ endDate: "2027-03-01" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["endDate"]);
  });
});

describe("destinationSchema", () => {
  it("validates time zones and coordinates", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(destinationSchema.safeParse({ name: "X", scope: "city", timezone: "Mars/Base" }).success).toBe(false);
    expect(destinationSchema.safeParse({ name: "X", scope: "city", timezone: "UTC", lat: 91 }).success).toBe(false);
  });
});

describe("tripPatchSchema", () => {
  it("only allows title, dates, and archived", () => {
    expect(tripPatchSchema.safeParse({ archived: true }).success).toBe(true);
    expect(tripPatchSchema.safeParse({ userId: "someone-else" }).success).toBe(false);
    expect(tripPatchSchema.safeParse({ destination: { name: "Paris" } }).success).toBe(false);
  });
});

describe("eventCreateSchema overnight rule", () => {
  const ev = (start: string, end: string) => eventCreateSchema.safeParse({ title: "Night", start, end });
  it("accepts 22:00 -> 02:00 next day", () => {
    expect(ev("2027-04-02T22:00", "2027-04-03T02:00").success).toBe(true);
  });
  it("rejects 10:00 -> 02:00 next day and equal times, with a clear message", () => {
    const typo = ev("2027-04-02T10:00", "2027-04-03T02:00");
    expect(typo.success).toBe(false);
    expect(typo.error?.issues[0].message).toMatch(/starting at 18:00 or later/);
    expect(ev("2027-04-02T22:00", "2027-04-02T22:00").success).toBe(false);
  });
});
