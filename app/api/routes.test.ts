import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetFileStoreForTests } from "@/lib/store/collections";
import { createEvents, createTrip, getEvent } from "@/lib/store/repo";
import type { Trip, TripEvent } from "@/lib/types";
import { PATCH as patchEvent } from "./events/[id]/route";
import { POST as createEvent } from "./trips/[id]/events/route";
import { PATCH as patchTrip } from "./trips/[id]/route";

vi.stubEnv("MONGODB_URI", "");

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) => new Request("http://test/api", { method: "PATCH", body: JSON.stringify(body) });

let trip: Trip;
let booking: TripEvent;

beforeEach(async () => {
  __resetFileStoreForTests();
  trip = await createTrip({
    userId: "demo-user",
    title: "Test",
    destination: { name: "Tokyo, Japan", scope: "city", timezone: "Asia/Tokyo" },
    startDate: "2027-04-01",
    endDate: "2027-04-05",
    archived: false,
  });
  [booking] = await createEvents([
    { tripId: trip.id, title: "Flight lands", start: "2027-04-01T09:00:00", end: "2027-04-01T10:00:00", source: "booking" },
    { tripId: trip.id, title: "Dinner", start: "2027-04-05T19:00:00", end: "2027-04-05T21:00:00", source: "user" },
  ]);
});

describe("PATCH /api/events/:id for booking events", () => {
  it("allows editing the title when the form resends unchanged times", async () => {
    const res = await patchEvent(req({ title: "JL5 lands", start: "2027-04-01T09:00", end: "2027-04-01T10:00" }), ctx(booking.id));
    expect(res.status).toBe(200);
    expect((await getEvent(booking.id))?.title).toBe("JL5 lands");
  });

  it("rejects a real time change with 409 (before any range check)", async () => {
    const res = await patchEvent(req({ start: "2027-06-01T09:00", end: "2027-06-01T10:00" }), ctx(booking.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/follow the booking/);
  });
});

describe("PATCH /api/events/:id on AI events", () => {
  it("pins an AI event when the traveler moves it, and allows unpinning", async () => {
    const [ai] = await createEvents([{ tripId: trip.id, title: "Museum", start: "2027-04-02T10:00:00", end: "2027-04-02T11:00:00", source: "ai" }]);
    expect((await patchEvent(req({ start: "2027-04-02T14:00", end: "2027-04-02T15:00" }), ctx(ai.id))).status).toBe(200);
    expect((await getEvent(ai.id))?.pinned).toBe(true);
    await patchEvent(req({ pinned: false }), ctx(ai.id));
    expect((await getEvent(ai.id))?.pinned).toBe(false);
  });
});

describe("PATCH /api/trips/:id date changes", () => {
  it("rejects shrinking the trip when events would fall outside, naming the count", async () => {
    const res = await patchTrip(req({ endDate: "2027-04-03" }), ctx(trip.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("1 event falls outside the new dates. Move or delete it first.");
  });

  it("allows shrinking when nothing is affected, and extending at any time", async () => {
    expect((await patchTrip(req({ endDate: "2027-04-07" }), ctx(trip.id))).status).toBe(200);
    expect((await patchTrip(req({ endDate: "2027-04-05" }), ctx(trip.id))).status).toBe(200);
  });
});


describe("overnight events through the API", () => {
  const post = (body: unknown) => createEvent(new Request("http://test/api", { method: "POST", body: JSON.stringify(body) }), ctx(trip.id));

  it("accepts a night out past midnight, including the last night up to 03:00 after the trip", async () => {
    expect((await post({ title: "Club", start: "2027-04-02T22:00", end: "2027-04-03T02:00" })).status).toBe(201);
    expect((await post({ title: "Last night", start: "2027-04-05T22:30", end: "2027-04-06T02:30" })).status).toBe(201);
  });

  it("rejects events past 03:00 after the trip or starting after it", async () => {
    expect((await post({ title: "Too late", start: "2027-04-05T23:00", end: "2027-04-06T04:00" })).status).toBe(400);
    expect((await post({ title: "After", start: "2027-04-06T00:30", end: "2027-04-06T01:30" })).status).toBe(400);
  });
});

describe("overnight rule through the API", () => {
  const post = (body: unknown) => createEvent(new Request("http://test/api", { method: "POST", body: JSON.stringify(body) }), ctx(trip.id));

  it("POST: 22:00 -> 02:00 is accepted; 10:00 -> 02:00 and equal times are rejected", async () => {
    expect((await post({ title: "Club", start: "2027-04-02T22:00", end: "2027-04-03T02:00" })).status).toBe(201);
    const typo = await post({ title: "Typo", start: "2027-04-02T10:00", end: "2027-04-03T02:00" });
    expect(typo.status).toBe(400);
    expect((await typo.json()).error).toMatch(/starting at 18:00 or later/);
    expect((await post({ title: "Zero", start: "2027-04-02T22:00", end: "2027-04-02T22:00" })).status).toBe(400);
  });

  it("PATCH: moving a night's start into the daytime is rejected (merged times), renaming is not", async () => {
    const [night] = await createEvents([{ tripId: trip.id, title: "Club", start: "2027-04-02T22:00:00", end: "2027-04-03T02:00:00", source: "user" }]);
    const moved = await patchEvent(req({ start: "2027-04-02T15:00" }), ctx(night.id));
    expect(moved.status).toBe(400);
    expect((await moved.json()).error).toMatch(/starting at 18:00 or later/);
    // A legacy event that breaks the rule can still be renamed: unchanged times aren't re-checked.
    const [legacy] = await createEvents([{ tripId: trip.id, title: "Old", start: "2027-04-03T10:00:00", end: "2027-04-04T02:00:00", source: "user" }]);
    expect((await patchEvent(req({ title: "Renamed", start: "2027-04-03T10:00", end: "2027-04-04T02:00" }), ctx(legacy.id))).status).toBe(200);
  });
});
