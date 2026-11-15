import { describe, expect, it } from "vitest";
import { eventTimesError } from "./events";

describe("eventTimesError (shared by the event form and the API)", () => {
  it("accepts a night out from an evening start, ending by 03:00 the next day", () => {
    expect(eventTimesError("2027-04-02T22:00:00", "2027-04-03T02:00:00")).toBeNull();
    expect(eventTimesError("2027-04-02T18:00:00", "2027-04-03T03:00:00")).toBeNull();
    expect(eventTimesError("2027-04-02T20:00:00", "2027-04-03T00:00:00")).toBeNull();
  });

  it("rejects a daytime start that runs past midnight (the 10:00 -> 02:00 typo)", () => {
    expect(eventTimesError("2027-04-02T10:00:00", "2027-04-03T02:00:00")).toMatch(/starting at 18:00 or later/);
    expect(eventTimesError("2027-04-02T17:59:00", "2027-04-03T00:30:00")).toMatch(/starting at 18:00 or later/);
  });

  it("rejects equal or reversed times, nights past 03:00, and multi-night spans", () => {
    expect(eventTimesError("2027-04-02T22:00:00", "2027-04-02T22:00:00")).toBe("End must be after start");
    expect(eventTimesError("2027-04-02T22:00:00", "2027-04-02T21:00:00")).toBe("End must be after start");
    expect(eventTimesError("2027-04-02T22:00:00", "2027-04-03T03:30:00")).toMatch(/end by 03:00/);
    expect(eventTimesError("2027-04-02T22:00:00", "2027-04-04T01:00:00")).toMatch(/more than one night/);
  });

  it("leaves same-day events alone", () => {
    expect(eventTimesError("2027-04-02T09:00:00", "2027-04-02T23:59:00")).toBeNull();
  });
});
