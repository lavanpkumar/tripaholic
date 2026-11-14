import { describe, expect, it } from "vitest";
import { searchFlights } from "./mock-flights";
import { searchLodging } from "./mock-lodging";

const fq = { origin: "JFK", destination: "HND", departDate: "2027-04-01", returnDate: "2027-04-05", passengers: 1 };
const lq = { location: "Tokyo, Japan", checkIn: "2027-04-01", checkOut: "2027-04-05", guests: 2 };

describe("mock flight provider", () => {
  it("is deterministic for the same query and different for another", () => {
    expect(searchFlights(fq)).toEqual(searchFlights(fq));
    expect(searchFlights({ ...fq, departDate: "2027-04-02" }).map((o) => o.id)).not.toEqual(searchFlights(fq).map((o) => o.id));
  });

  it("returns 6-10 options with real tradeoffs", () => {
    const opts = searchFlights(fq);
    expect(opts.length).toBeGreaterThanOrEqual(6);
    expect(opts.length).toBeLessThanOrEqual(10);
    expect(opts.some((o) => o.outbound.stops === 0)).toBe(true);
    expect(opts.some((o) => o.outbound.stops > 0 && o.outbound.via)).toBe(true);
    expect(opts.some((o) => o.tags.includes("Red-eye"))).toBe(true);
    expect(opts.filter((o) => o.tags.includes("Cheapest"))).toHaveLength(1);
    expect(new Set(opts.map((o) => o.price)).size).toBeGreaterThan(4);
  });

  it("converts arrival times into the destination time zone", () => {
    const o = searchFlights(fq)[0];
    // JFK (UTC-4 in April) to Tokyo (UTC+9): arrival wall clock = depart + duration + 13h.
    const dep = Date.parse(o.outbound.depart + "Z");
    const arr = Date.parse(o.outbound.arrive + "Z");
    expect(arr - dep).toBe((o.outbound.durationMinutes + 13 * 60) * 60_000);
  });

  it("keeps flight identity (key) across party size and cabin, but not across dates", () => {
    const keys = (q: typeof fq) => searchFlights(q).map((o) => o.key).sort();
    expect(keys({ ...fq, passengers: 3 })).toEqual(keys(fq));
    expect(searchFlights({ ...fq, passengers: 3 })[0].id).not.toBe(searchFlights(fq)[0].id);
    expect(keys({ ...fq, departDate: "2027-04-02" })).not.toEqual(keys(fq));
  });

  it("scales price with passengers and includes a return leg", () => {
    const one = searchFlights(fq);
    const two = searchFlights({ ...fq, passengers: 2 });
    expect(two[0].price).toBeGreaterThan(one[0].price * 1.5);
    expect(one.every((o) => o.inbound?.from === "HND")).toBe(true);
  });
});

describe("mock lodging provider", () => {
  it("is deterministic and varied", () => {
    const a = searchLodging(lq);
    expect(a).toEqual(searchLodging(lq));
    expect(a.length).toBeGreaterThanOrEqual(6);
    expect(new Set(a.map((o) => o.type))).toEqual(new Set(["hotel", "airbnb"]));
    expect(a.every((o) => o.nights === 4 && o.totalPrice === o.nightlyPrice * 4)).toBe(true);
  });

  it("returns the same properties for a place whatever the dates or guests", () => {
    const keys = (q: typeof lq) => new Set(searchLodging(q).map((o) => o.key));
    const a = keys(lq);
    const b = keys({ ...lq, checkIn: "2027-06-01", checkOut: "2027-06-03", guests: 4 });
    expect(b).toEqual(a);
    expect([...keys({ ...lq, location: "Kyoto, Japan" })].some((k) => a.has(k))).toBe(false);
  });

  it("always offers choices under a stated budget", () => {
    expect(searchLodging({ ...lq, budget: 90 }).filter((o) => o.nightlyPrice <= 90).length).toBeGreaterThanOrEqual(2);
  });
});
