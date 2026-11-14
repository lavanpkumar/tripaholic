import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as confirm } from "@/app/api/trips/[id]/bookings/confirm/route";
import { __resetFileStoreForTests } from "../store/collections";
import { appendStep, createRun, createTrip, listBookings } from "../store/repo";
import type { LodgingBookingDetails, Trip } from "../types";
import type { LodgingOption as ProviderStay } from "../providers";
import { runAgent } from "./agent";
import { Toolbox } from "./agent-tools";

vi.stubEnv("MONGODB_URI", "");
vi.stubEnv("GEMINI_API_KEY", "");

let trip: Trip;
beforeEach(async () => {
  __resetFileStoreForTests();
  trip = await createTrip({
    userId: "demo-user",
    title: "Lisbon",
    destination: { name: "Lisbon, Portugal", scope: "city", timezone: "Europe/Lisbon", lat: 38.72, lng: -9.14, country: "Portugal" },
    startDate: "2027-05-10",
    endDate: "2027-05-15",
    archived: false,
  });
});

describe("Toolbox", () => {
  it("books a property with the dates and guests of the search that returned it", async () => {
    const tb = new Toolbox(trip, true);
    const first = await tb.exec("search_lodging", { checkIn: "2027-05-10", checkOut: "2027-05-12", guests: 2 });
    await tb.exec("search_lodging", { checkIn: "2027-05-12", checkOut: "2027-05-15", guests: 1 });
    const pick = (first.options as ProviderStay[])[0];
    const out = await tb.exec("book_lodging", { propertyId: pick.id, rationale: "test" });
    const d = out.booking!.details as LodgingBookingDetails;
    expect([d.checkIn, d.checkOut, d.guests]).toEqual(["2027-05-10", "2027-05-12", 2]);
    expect(out.booking!.priceTotal).toBe(pick.totalPrice);
  });

  it("rejects malformed or out-of-trip dates from the model", async () => {
    const tb = new Toolbox(trip, true);
    expect((await tb.exec("search_lodging", { checkIn: "May 10" })).error).toMatch(/YYYY-MM-DD/);
    expect((await tb.exec("search_lodging", { checkIn: "2027-08-01", checkOut: "2027-08-03" })).error).toMatch(/outside this trip/);
    expect((await tb.exec("search_lodging", { checkIn: "2027-05-12", checkOut: "2027-05-11" })).error).toMatch(/after checkIn/);
    expect((await tb.exec("search_flights", { origin: "JFK", departDate: "2026-01-01" })).error).toMatch(/outside this trip/);
    expect((await tb.exec("search_flights", { origin: "JFK", departDate: "2027-05-09" })).error).toBeUndefined(); // day before is fine
    expect(await listBookings(trip.id)).toHaveLength(0);
  });
});

describe("POST /api/trips/:id/bookings/confirm", () => {
  it("books exactly once under a double-click", async () => {
    const run = await createRun({ tripId: trip.id, kind: "lodging", userRequest: "cheap hotel", autoBook: false, mode: "offline" });
    const { final } = await runAgent({ trip, kind: "lodging", autoBook: false }, "cheap hotel", (s) => appendStep(run.id, s), { stepDelayMs: 0 });
    const optionId = final.proposal!.optionId;
    const req = () =>
      confirm(new Request("http://test", { method: "POST", body: JSON.stringify({ runId: run.id, optionId }) }), { params: Promise.resolve({ id: trip.id }) });
    const [a, b] = await Promise.all([req(), req()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await listBookings(trip.id)).toHaveLength(1);
    expect((await req()).status).toBe(409); // and a later retry sees it as booked
  });
});
