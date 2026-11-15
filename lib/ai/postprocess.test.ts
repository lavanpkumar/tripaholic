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
        ev("2027-02-08T09:00", "2027-02-08T10:00"), // before landing window -> shifted to 12:00
        ev("2027-02-08T07:00", "2027-02-08T08:00"), // would need a 5h shift -> dropped
        ev("2027-02-10T17:00", "2027-02-10T18:00"), // after latest -> dropped
        ev("2027-02-10T09:00", "2027-02-10T10:00"),
      ],
      { ...base, earliest: "2027-02-08T12:00:00", latest: "2027-02-10T13:00:00" },
    );
    expect(r.events.map((e) => e.start)).toEqual(["2027-02-08T12:00:00", "2027-02-10T09:00:00"]);
    expect(r.dropped).toBe(2);
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
        ev("2027-02-09T17:00", "2027-02-09T22:30"),
        ev("2027-02-09T17:30", "2027-02-09T18:30"), // daytime start, pushed to 22:30-23:30 > 23:00 -> dropped
        ev("2027-02-09T09:00", "2027-02-09T11:00"),
        ev("2027-02-09T10:00", "2027-02-09T11:00"), // pushed to 11:00
      ],
      base,
    );
    const day = r.events.filter((e) => e.start.startsWith("2027-02-09"));
    expect(day.map((e) => e.start.slice(11, 16))).toEqual(["09:00", "11:00", "17:00"]);
    for (const a of r.events) for (const b of r.events) if (a !== b) expect(overlaps(a, b)).toBe(false);
    expect(r.dropped).toBe(1);
  });

  it("caps events per day", () => {
    const many = Array.from({ length: 8 }, (_, i) => ev(`2027-02-09T${String(8 + i * 2).padStart(2, "0")}:00`, `2027-02-09T${String(9 + i * 2).padStart(2, "0")}:00`));
    const r = postprocessPlan(many, { ...base, maxPerDay: 4 });
    expect(r.events).toHaveLength(4);
  });
});

describe("postprocessPlan nightlife", () => {
  const night = (start: string, end: string, extra: Record<string, unknown> = {}) => ev(start, end, { category: "activity", title: "Club", ...extra });
  const noOverlaps = (events: { start: string; end: string }[]) => {
    for (const a of events) for (const b of events) if (a !== b) expect(overlaps(a, b)).toBe(false);
  };

  it("keeps a 22:00-02:00 night out", () => {
    const r = postprocessPlan([night("2027-02-08T22:00", "2027-02-09T02:00")], base);
    expect(r.events.map((e) => [e.start, e.end])).toEqual([["2027-02-08T22:00:00", "2027-02-09T02:00:00"]]);
  });

  it("still keeps daytime events inside the day: 10:00-23:30 is trimmed, never runs to midnight", () => {
    const r = postprocessPlan([ev("2027-02-09T10:00", "2027-02-09T23:30")], base);
    for (const e of r.events) expect(e.end <= "2027-02-09T23:00:00").toBe(true);
    expect(r.events.every((e) => e.start.startsWith("2027-02-09"))).toBe(true);
  });

  it("does not let a daytime event be pushed past 23:00 into the night", () => {
    const fixed = [{ start: "2027-02-09T19:00:00", end: "2027-02-09T22:30:00" }];
    const r = postprocessPlan([ev("2027-02-09T21:00", "2027-02-09T22:00", { category: "food" })], { ...base, fixed });
    // 21:00 is an evening start, so it may move to 22:30-23:30; a 15:00 start could not.
    const d = postprocessPlan([ev("2027-02-09T15:00", "2027-02-09T17:00")], { ...base, fixed: [{ start: "2027-02-09T14:00:00", end: "2027-02-09T22:00:00" }] });
    expect(r.events[0]?.end).toBe("2027-02-09T23:30:00");
    expect(d.events).toHaveLength(0);
  });

  it("drops nights that would run past 03:00, and resolves overlapping nights without overlaps", () => {
    const r = postprocessPlan(
      [
        night("2027-02-08T22:00", "2027-02-09T04:00"), // past 03:00 -> dropped
        night("2027-02-09T21:30", "2027-02-10T01:00"),
        night("2027-02-09T22:00", "2027-02-10T02:00"), // pushed to 01:00-05:00 -> past 03:00 and next day -> dropped
        ev("2027-02-09T19:00", "2027-02-09T20:30", { category: "food" }),
      ],
      base,
    );
    expect(r.events.map((e) => `${e.start.slice(5, 16)}-${e.end.slice(5, 16)}`)).toEqual(["02-09T19:00-02-09T20:30", "02-09T21:30-02-10T01:00"]);
    expect(r.dropped).toBe(2);
    noOverlaps(r.events);
  });

  it("lets the last night run to 03:00 after the end date, but no later, and nothing starts after the trip", () => {
    const r = postprocessPlan(
      [
        night("2027-02-10T22:30", "2027-02-11T01:30"),
        night("2027-02-10T23:00", "2027-02-11T03:30", { title: "Too late" }),
        ev("2027-02-11T00:30", "2027-02-11T01:00", { title: "After the trip" }),
      ],
      base,
    );
    expect(r.events.map((e) => e.title)).toEqual(["Club"]);
    expect(r.events[0].end).toBe("2027-02-11T01:30:00");
  });
});
