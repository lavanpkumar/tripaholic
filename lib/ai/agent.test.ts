import { beforeEach, describe, expect, it, vi } from "vitest";
import { hhmm } from "../dates";
import type { FlightOption } from "../providers";
import { __resetFileStoreForTests } from "../store/collections";
import { createTrip, listBookings, listEvents } from "../store/repo";
import type { AgentFinal, AgentStep, FlightBookingDetails, LodgingBookingDetails, Trip } from "../types";
import { runAgent, type AgentDeps } from "./agent";
import { parseFlightRequest, parseStayRequest } from "./agent-scoring";

vi.stubEnv("MONGODB_URI", "");
vi.stubEnv("GEMINI_API_KEY", "");

let trip: Trip;
beforeEach(async () => {
  __resetFileStoreForTests();
  trip = await createTrip({
    userId: "demo-user",
    title: "Tokyo",
    destination: { name: "Tokyo, Japan", scope: "city", timezone: "Asia/Tokyo", lat: 35.68, lng: 139.69, country: "Japan" },
    startDate: "2027-04-01",
    endDate: "2027-04-05",
    archived: false,
  });
});

function collect() {
  const steps: AgentStep[] = [];
  return { steps, emit: (s: AgentStep) => void steps.push(s) };
}
const offline: AgentDeps = { stepDelayMs: 0 };

describe("request parsing", () => {
  it("understands the demo flight request", () => {
    expect(parseFlightRequest("cheapest direct flight from JFK, arriving before noon")).toMatchObject({
      origin: "JFK",
      goal: "cheapest",
      nonstop: true,
      arriveBefore: "12:00",
      passengers: 1,
    });
    expect(parseFlightRequest("2 adults from Chicago, fastest, land by 6pm")).toMatchObject({ origin: "ORD", passengers: 2, goal: "fastest", arriveBefore: "18:00" });
  });
  it("understands stay requests", () => {
    expect(parseStayRequest("hotel near Shinjuku under $200 a night with breakfast, 2 guests")).toMatchObject({
      type: "hotel",
      budget: 200,
      amenities: ["Breakfast included"],
      guests: 2,
      area: "Shinjuku",
    });
    expect(parseStayRequest("cheapest airbnb with a kitchen").goal).toBe("cheapest");
  });
});

describe("offline agent", () => {
  it("searches, compares, explains, and books the right flight, then puts it on the calendar", async () => {
    const { steps, emit } = collect();
    const { final, mode } = await runAgent({ trip, kind: "flight", autoBook: true }, "cheapest direct flight from JFK arriving before noon", emit, offline);
    expect(mode).toBe("offline");
    expect(final.status).toBe("booked");
    const types = steps.map((s) => s.type);
    expect(types[0]).toBe("thought");
    expect(types).toContain("tool_call");
    expect(types.at(-1)).toBe("final");
    expect(steps.filter((s) => s.type === "tool_call").map((s) => (s.content as { name: string }).name).at(-1)).toBe("book_flight");

    // The booked option is the cheapest nonstop landing by noon on day one, among everything searched.
    const searched = steps
      .filter((s) => s.type === "tool_result" && (s.content as { name: string }).name === "search_flights")
      .flatMap((s) => (s.content as { options: FlightOption[] }).options);
    const fit = searched.filter((o) => o.outbound.stops === 0 && o.outbound.arrive <= "2027-04-01T12:00:00").sort((a, b) => a.price - b.price);
    const details = final.booking!.details as FlightBookingDetails;
    expect(fit.length).toBeGreaterThan(0);
    expect(details.optionId).toBe(fit[0].id);
    expect(hhmm(details.arrivalAtDestination) <= "12:00" && details.arrivalAtDestination.startsWith("2027-04-01")).toBe(true);

    const [booking] = await listBookings(trip.id);
    expect(booking.confirmationCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(booking.bookedBy).toBe("agent");
    expect(booking.rationale).toContain("fits best");
    const events = await listEvents(trip.id);
    expect(events.some((e) => e.source === "booking" && e.bookingId === booking.id)).toBe(true);
  });

  it("books lodging with check-in and check-out on the itinerary", async () => {
    const { emit } = collect();
    const { final } = await runAgent({ trip, kind: "lodging", autoBook: true }, "best rated hotel with breakfast", emit, offline);
    expect(final.status).toBe("booked");
    const d = final.booking!.details as LodgingBookingDetails;
    expect([d.checkIn, d.checkOut]).toEqual(["2027-04-01", "2027-04-05"]);
    const titles = (await listEvents(trip.id)).map((e) => e.title);
    expect(titles.some((t) => t.startsWith("Check in"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Check out"))).toBe(true);
  });

  it("keeps flight blocks short and moves hotel check-in after landing + transfer", async () => {
    const { emit } = collect();
    const { final } = await runAgent({ trip, kind: "flight", autoBook: true }, "fastest flight from JFK arriving by 2pm", emit, offline);
    await runAgent({ trip, kind: "lodging", autoBook: true }, "cheapest hotel", emit, offline);
    const landing = (final.booking!.details as FlightBookingDetails).arrivalAtDestination;
    const events = await listEvents(trip.id);
    const flightBlock = events.find((e) => e.title.includes("lands at"))!;
    expect(flightBlock.end).toBe(landing);
    expect(Date.parse(flightBlock.end + "Z") - Date.parse(flightBlock.start + "Z")).toBeLessThanOrEqual(120 * 60_000);
    const checkIn = events.find((e) => e.title.startsWith("Check in"))!;
    if (checkIn.start.slice(0, 10) === landing.slice(0, 10)) {
      expect(Date.parse(checkIn.start + "Z") - Date.parse(landing + "Z")).toBeGreaterThanOrEqual(90 * 60_000);
    }
  });

  it("proposes instead of booking when auto-book is off", async () => {
    const { emit } = collect();
    const { final } = await runAgent({ trip, kind: "flight", autoBook: false }, "fastest flight from LAX", emit, offline);
    expect(final.status).toBe("awaiting_confirmation");
    expect(final.proposal?.optionId).toMatch(/^FL-/);
    expect(await listBookings(trip.id)).toHaveLength(0);
  });

  it("asks for the origin instead of guessing", async () => {
    const { emit } = collect();
    const { final } = await runAgent({ trip, kind: "flight", autoBook: true }, "cheapest flight please", emit, offline);
    expect(final.status).toBe("failed");
    expect(final.message).toMatch(/Where are you flying from/);
  });
});

describe("Gemini agent loop", () => {
  it("executes function calls, feeds results back, and books", async () => {
    let turn = 0;
    let firstId = "";
    const deps: AgentDeps = {
      sleep: async () => {},
      generate: async (params) => {
        turn++;
        if (turn === 1)
          return {
            candidates: [{ content: { role: "model", parts: [{ text: "Searching flights from JFK." }] } }],
            functionCalls: [{ id: "c1", name: "search_flights", args: { origin: "JFK" } }],
          };
        if (turn === 2) {
          const last = params.contents as { parts: { functionResponse?: { response: { options: { id: string }[] } } }[] }[];
          firstId = last.at(-1)!.parts[0].functionResponse!.response.options[0].id;
          return {
            candidates: [{ content: { role: "model", parts: [{ text: "Booking the cheapest." }] } }],
            functionCalls: [{ id: "c2", name: "book_flight", args: { optionId: firstId, rationale: "Cheapest overall." } }],
          };
        }
        return { candidates: [{ content: { role: "model", parts: [{ text: "You're booked!" }] } }], functionCalls: [] };
      },
    };
    const { steps, emit } = collect();
    const { final, mode } = await runAgent({ trip, kind: "flight", autoBook: true }, "cheapest from JFK", emit, deps);
    expect(mode).toBe("gemini");
    expect(final).toMatchObject({ status: "booked", message: "You're booked!" } satisfies Partial<AgentFinal>);
    expect((final.booking!.details as FlightBookingDetails).optionId).toBe(firstId);
    expect(steps.map((s) => s.type)).toEqual(["thought", "tool_call", "tool_result", "thought", "tool_call", "tool_result", "final"]);
  });

  it("falls back to the offline agent when Gemini errors", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps: AgentDeps = {
      stepDelayMs: 0,
      sleep: async () => {},
      generate: async () => {
        throw Object.assign(new Error("quota"), { status: 429 });
      },
    };
    const { steps, emit } = collect();
    const { final, mode } = await runAgent({ trip, kind: "lodging", autoBook: true }, "cheap airbnb", emit, deps);
    err.mockRestore();
    expect(mode).toBe("offline");
    expect(final.status).toBe("booked");
    expect((steps[0].content as { text: string }).text).toMatch(/rate limit/);
  });
});
