import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetFileStoreForTests } from "@/lib/store/collections";
import { createEvents, createTrip, getEvent } from "@/lib/store/repo";
import type { Trip, TripEvent } from "@/lib/types";
import { PATCH as patchEvent } from "./events/[id]/route";
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

