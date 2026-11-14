import { describe, expect, it } from "vitest";
import { overlaps } from "../events";
import { cleanEvent, postprocessPlan, type PlanConstraints } from "./postprocess";

const base: PlanConstraints = { startDate: "2027-02-08", endDate: "2027-02-10", fixed: [] };
const ev = (start: string, end: string, extra: Record<string, unknown> = {}) => ({
  title: "Thing",
  start,
  end,
  category: "sight",
  reason: "Because",
  ...extra,
});

describe("cleanEvent", () => {
  it("drops events with bad or reversed times and missing titles", () => {
    expect(cleanEvent(ev("nope", "2027-02-08T10:00"))).toBeNull();
    expect(cleanEvent(ev("2027-02-08T10:00", "2027-02-08T09:00"))).toBeNull();
    expect(cleanEvent({ ...ev("2027-02-08T09:00", "2027-02-08T10:00"), title: "  " })).toBeNull();
  });
  it("normalises times, defaults unknown categories, caps long events", () => {
    const e = cleanEvent(ev("2027-02-08T09:00", "2027-02-08T20:00", { category: "party" }))!;
    expect(e.start).toBe("2027-02-08T09:00:00");
    expect(e.category).toBe("other");
    expect(e.end).toBe("2027-02-08T15:00:00"); // 6h cap
  });
});

describe("postprocessPlan range rules", () => {
  it("drops events outside the trip dates", () => {
    const r = postprocessPlan(
      [ev("2027-02-07T10:00", "2027-02-07T11:00"), ev("2027-02-11T10:00", "2027-02-11T11:00"), ev("2027-02-09T10:00", "2027-02-09T11:00")],
      base,
    );
    expect(r.events.map((e) => e.start)).toEqual(["2027-02-09T10:00:00"]);
    expect(r.dropped).toBe(2);
  });

  it("does not schedule before landing or after leaving for the airport", () => {
    const r = postprocessPlan(
      [
        ev("2027-02-08T09:00", "2027-02-08T10:00"), // before landing window -> shifted to 14:00
        ev("2027-02-10T17:00", "2027-02-10T18:00"), // after latest -> dropped
        ev("2027-02-10T09:00", "2027-02-10T10:00"),
      ],
      { ...base, earliest: "2027-02-08T14:00:00", latest: "2027-02-10T13:00:00" },
    );
    expect(r.events.map((e) => e.start)).toEqual(["2027-02-08T14:00:00", "2027-02-10T09:00:00"]);
    expect(r.dropped).toBe(1);
  });

  it("keeps regular events inside daily hours but lets travel run early", () => {
    const r = postprocessPlan(
      [ev("2027-02-09T05:00", "2027-02-09T06:00"), ev("2027-02-09T05:30", "2027-02-09T07:00", { category: "travel" })],
      base,
    );
    const starts = r.events.map((e) => `${e.category}@${e.start.slice(11, 16)}`).sort();
    expect(starts).toEqual(["sight@07:00", "travel@05:30"]);
  });
});

describe("postprocessPlan overlap resolution", () => {
  it("moves AI events off user events and never touches the user event", () => {
    const fixed = [{ start: "2027-02-09T10:00:00", end: "2027-02-09T12:00:00" }];
    const r = postprocessPlan([ev("2027-02-09T11:00", "2027-02-09T12:00")], { ...base, fixed });
    expect(r.events[0].start).toBe("2027-02-09T12:00:00");
    expect(r.moved).toBe(1);
    expect(fixed[0]).toEqual({ start: "2027-02-09T10:00:00", end: "2027-02-09T12:00:00" });
  });

  it("resolves overlaps among AI events, and drops what cannot fit before day end", () => {
    const r = postprocessPlan(
      [
        ev("2027-02-09T20:00", "2027-02-09T22:00"),
        ev("2027-02-09T21:00", "2027-02-09T22:30"), // pushed to 22:00-23:30 > 23:00 -> dropped
        ev("2027-02-09T09:00", "2027-02-09T11:00"),
        ev("2027-02-09T10:00", "2027-02-09T11:00"), // pushed to 11:00
      ],
      base,
    );
    const day = r.events.filter((e) => e.start.startsWith("2027-02-09"));
    expect(day.map((e) => e.start.slice(11, 16))).toEqual(["09:00", "11:00", "20:00"]);
    for (const a of r.events) for (const b of r.events) if (a !== b) expect(overlaps(a, b)).toBe(false);
    expect(r.dropped).toBe(1);
  });

  it("caps events per day", () => {
    const many = Array.from({ length: 8 }, (_, i) => ev(`2027-02-09T${String(8 + i * 2).padStart(2, "0")}:00`, `2027-02-09T${String(9 + i * 2).padStart(2, "0")}:00`));
    const r = postprocessPlan(many, { ...base, maxPerDay: 4 });
    expect(r.events).toHaveLength(4);
  });
});
