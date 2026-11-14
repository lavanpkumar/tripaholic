import { beforeEach, describe, expect, it, vi } from "vitest";
import { overlaps } from "../events";
import { __resetFileStoreForTests } from "../store/collections";
import { createEvents, createTrip, listEvents } from "../store/repo";
import type { Trip } from "../types";
import type { GeminiDeps } from "./gemini";
import { generateItinerary } from "./itinerary";

// Force the local file store and no real Gemini key for these tests.
vi.stubEnv("MONGODB_URI", "");
vi.stubEnv("GEMINI_API_KEY", "");

async function makeTrip(scope: "city" | "country" = "city"): Promise<Trip> {
  return createTrip({
    userId: "demo-user",
    title: "Test",
    destination: scope === "city" ? { name: "Tokyo, Japan", scope, timezone: "Asia/Tokyo" } : { name: "Japan", scope, timezone: "Asia/Tokyo" },
    startDate: "2027-04-01",
    endDate: "2027-04-04",
    archived: false,
  });
}

beforeEach(() => __resetFileStoreForTests());

describe("generateItinerary (offline planner)", () => {
  it("plans a 4-day trip with non-overlapping in-range events, reasons, and a summary", async () => {
    const trip = await makeTrip();
    const { events, summary, plan } = await generateItinerary(trip);
    expect(plan.mode).toBe("offline");
    expect(summary.summary.length).toBeGreaterThan(20);
    expect(events.length).toBeGreaterThanOrEqual(8);
    for (const e of events) {
      expect(e.source).toBe("ai");
      expect(e.start >= "2027-04-01T00:00:00" && e.end <= "2027-04-05T00:00:00").toBe(true);
      expect(e.aiReason).toBeTruthy();
    }
    for (const a of events) for (const b of events) if (a !== b) expect(overlaps(a, b)).toBe(false);
  });

  it("keeps a city trip in one city and spreads a country trip across several", async () => {
    const city = await generateItinerary(await makeTrip("city"));
    expect(new Set(city.events.map((e) => e.location))).toEqual(new Set(["Tokyo"]));
    const country = await generateItinerary(await makeTrip("country"));
    expect(new Set(country.events.map((e) => e.location)).size).toBeGreaterThan(1);
    expect(country.events.some((e) => e.category === "travel")).toBe(true);
  });

  it("regenerate replaces AI events but preserves user events untouched", async () => {
    const trip = await makeTrip();
    await generateItinerary(trip);
    const [mine] = await createEvents([
      { tripId: trip.id, title: "Dinner with Aiko", start: "2027-04-02T19:00:00", end: "2027-04-02T21:00:00", source: "user" },
    ]);
    const firstAi = (await listEvents(trip.id)).filter((e) => e.source === "ai").map((e) => e.id);

    const { events } = await generateItinerary(trip);
    const stillMine = events.find((e) => e.id === mine.id);
    expect(stillMine).toEqual(mine);
    const ai = events.filter((e) => e.source === "ai");
    expect(ai.some((e) => firstAi.includes(e.id))).toBe(false);
    for (const e of ai) expect(overlaps(e, mine)).toBe(false);
  });
});

describe("generateItinerary (Gemini path)", () => {
  it("uses Gemini output after post-processing", async () => {
    const trip = await makeTrip();
    const reply = {
      summary: "A relaxed Tokyo plan.",
      highlights: [{ title: "Neighborhood days", body: "Each day stays in one area." }],
      events: [
        { title: "Senso-ji", start: "2027-04-01T09:00", end: "2027-04-01T11:00", category: "sight", reason: "Quiet early." },
        { title: "Overlapping", start: "2027-04-01T10:00", end: "2027-04-01T11:00", category: "food", reason: "x" },
        { title: "Out of range", start: "2027-05-01T10:00", end: "2027-05-01T11:00", category: "food", reason: "x" },
      ],
    };
    const deps: GeminiDeps = { generate: async () => ({ text: JSON.stringify(reply) }), sleep: async () => {} };
    const { events, summary, plan } = await generateItinerary(trip, { deps });
    expect(plan.mode).toBe("gemini");
    expect(summary.summary).toBe("A relaxed Tokyo plan.");
    expect(events.map((e) => `${e.title}@${e.start.slice(11, 16)}`)).toEqual(["Senso-ji@09:00", "Overlapping@11:00"]);
  });

  it("falls back to the offline planner with a notice when Gemini fails", async () => {
    const trip = await makeTrip();
    const deps: GeminiDeps = {
      generate: async () => {
        throw Object.assign(new Error("API key not valid"), { status: 401 });
      },
      sleep: async () => {},
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { plan, summary } = await generateItinerary(trip, { deps });
    err.mockRestore();
    expect(plan.mode).toBe("offline");
    expect(summary.notice).toMatch(/rejected the API key/);
    expect(plan.events.length).toBeGreaterThan(0);
  });
});
