import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as confirm } from "@/app/api/trips/[id]/bookings/confirm/route";
import { __resetFileStoreForTests } from "../store/collections";
import { appendStep, createRun, createTrip, listBookings } from "../store/repo";
import type { LodgingBookingDetails, Trip } from "../types";
import type { FlightOption as ProviderFlight, LodgingOption as ProviderStay } from "../providers";
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

describe("Show me another option", () => {
  const shownIn = (steps: { content: unknown }[]) =>
    steps.flatMap((st) => ((st.content as { options?: { key: string }[] }).options ?? []).map((o) => o.key));

  it("hides passed-on options and proposes the next best", async () => {
    const first = await runAgent({ trip, kind: "lodging", autoBook: false }, "cheapest hotel", () => {}, { stepDelayMs: 0 });
    const passed = (first.final.proposal!.option as ProviderStay).key;
    const steps: { type: string; content: unknown }[] = [];
    const second = await runAgent({ trip, kind: "lodging", autoBook: false, exclude: [passed] }, "cheapest hotel", (st) => void steps.push(st), { stepDelayMs: 0 });
    expect(second.final.status).toBe("awaiting_confirmation");
    expect((second.final.proposal!.option as ProviderStay).key).not.toBe(passed);
    expect(shownIn(steps)).not.toContain(passed);
    expect(steps.some((st) => String((st.content as { summary?: string }).summary).includes("passed on hidden"))).toBe(true);
  });

  it("keeps a rejected hotel out when a different search returns it under a new id", async () => {
    const tb0 = new Toolbox(trip, true);
    const rejected = ((await tb0.exec("search_lodging", { guests: 1 })).options as ProviderStay[])[0];
    // A different query (dates and guests) returns the same property with a different option id.
    const tbProbe = new Toolbox(trip, true);
    const again = ((await tbProbe.exec("search_lodging", { guests: 3, checkIn: "2027-05-11", checkOut: "2027-05-14" })).options as ProviderStay[]).find(
      (o) => o.key === rejected.key,
    );
    expect(again).toBeDefined();
    expect(again!.id).not.toBe(rejected.id);

    const tb = new Toolbox(trip, true, new Set([rejected.key]));
    const out = await tb.exec("search_lodging", { guests: 3, checkIn: "2027-05-11", checkOut: "2027-05-14" });
    expect((out.options as ProviderStay[]).map((o) => o.key)).not.toContain(rejected.key);
    expect((await tb.exec("book_lodging", { propertyId: again!.id })).error).toMatch(/Unknown propertyId/);
  });

  it("keeps a rejected flight out when re-searched for a different party size", async () => {
    const tb0 = new Toolbox(trip, true);
    const rejected = ((await tb0.exec("search_flights", { origin: "JFK", passengers: 1 })).options as ProviderFlight[])[0];
    const tbProbe = new Toolbox(trip, true);
    const again = ((await tbProbe.exec("search_flights", { origin: "JFK", passengers: 3 })).options as ProviderFlight[]).find((o) => o.key === rejected.key);
    expect(again).toBeDefined();
    expect(again!.id).not.toBe(rejected.id);

    const tb = new Toolbox(trip, true, new Set([rejected.key]));
    const out = await tb.exec("search_flights", { origin: "JFK", passengers: 3 });
    expect((out.options as ProviderFlight[]).map((o) => o.key)).not.toContain(rejected.key);
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
