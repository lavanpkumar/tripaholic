import { describe, expect, it } from "vitest";
import { deriveStatus, withStatus } from "./status";
import type { Trip } from "./types";

const base = { archived: false, startDate: "2027-02-08", endDate: "2027-02-15" };

describe("deriveStatus", () => {
  it("is planned before the start date", () => {
    expect(deriveStatus(base, "2027-02-07")).toBe("planned");
  });
  it("is in progress on the start date (boundary)", () => {
    expect(deriveStatus(base, "2027-02-08")).toBe("in_progress");
  });
  it("is in progress mid-trip", () => {
    expect(deriveStatus(base, "2027-02-11")).toBe("in_progress");
  });
  it("is still in progress on the end date (boundary)", () => {
    expect(deriveStatus(base, "2027-02-15")).toBe("in_progress");
  });
  it("is archived the day after the end date", () => {
    expect(deriveStatus(base, "2027-02-16")).toBe("archived");
  });
  it("is archived when manually archived, even for a future trip", () => {
    expect(deriveStatus({ ...base, archived: true }, "2026-01-01")).toBe("archived");
  });
  it("handles single-day trips", () => {
    const one = { archived: false, startDate: "2027-03-01", endDate: "2027-03-01" };
    expect(deriveStatus(one, "2027-02-28")).toBe("planned");
    expect(deriveStatus(one, "2027-03-01")).toBe("in_progress");
    expect(deriveStatus(one, "2027-03-02")).toBe("archived");
  });
});

describe("withStatus", () => {
  it("evaluates 'today' in the destination time zone", () => {
    const trip: Trip = {
      id: "t",
      userId: "u",
      title: "Tokyo",
      destination: { name: "Tokyo", scope: "city", timezone: "Asia/Tokyo" },
      startDate: "2027-02-08",
      endDate: "2027-02-10",
      archived: false,
      createdAt: "",
      updatedAt: "",
    };
    // 2027-02-07 20:00 UTC is already 2027-02-08 05:00 in Tokyo.
    expect(withStatus(trip, new Date("2027-02-07T20:00:00Z")).status).toBe("in_progress");
    expect(withStatus(trip, new Date("2027-02-07T10:00:00Z")).status).toBe("planned");
  });
});
