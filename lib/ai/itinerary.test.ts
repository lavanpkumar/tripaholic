import { beforeEach, describe, expect, it, vi } from "vitest";
import { overlaps } from "../events";
import { __resetFileStoreForTests } from "../store/collections";
import { createEvents, createTrip, listEvents, updateEvent } from "../store/repo";
import type { Trip } from "../types";
import type { GeminiDeps } from "./gemini";
import { buildConstraints } from "./context";
import { generateItinerary } from "./itinerary";
import { buildPrompt } from "./planner";

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

describe("generateItinerary pinning and concurrency", () => {
  it("keeps a pinned (moved) AI event on regenerate and plans around it", async () => {
    const trip = await makeTrip();
    const { events } = await generateItinerary(trip);
    const moved = (await updateEvent(events[0].id, { start: "2027-04-03T21:00:00", end: "2027-04-03T22:00:00", pinned: true }))!;
    const after = await generateItinerary(trip);
    const kept = after.events.find((e) => e.id === moved.id);
    expect(kept).toMatchObject({ start: moved.start, end: moved.end, pinned: true, source: "ai" });
    for (const e of after.events) if (e.id !== moved.id) expect(overlaps(e, moved)).toBe(false);
  });

  it("rejects a second generate for the same trip while one is running", async () => {
    const trip = await makeTrip();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: GeminiDeps = {
      generate: async () => {
        await gate;
        return { text: JSON.stringify({ summary: "x", highlights: [], events: [{ title: "A", start: "2027-04-01T10:00", end: "2027-04-01T11:00", category: "sight", reason: "r" }] }) };
      },
    };
    const first = generateItinerary(trip, { deps: slow });
    await expect(generateItinerary(trip)).rejects.toMatchObject({ status: 409 });
    release();
    await expect(first).resolves.toBeTruthy();
    await expect(generateItinerary(trip)).resolves.toBeTruthy(); // lock released
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

describe("nightlife requests", () => {
  async function miami(): Promise<Trip> {
    return createTrip({
      userId: "demo-user",
      title: "Miami",
      destination: { name: "Miami, United States", scope: "city", timezone: "America/New_York" },
      startDate: "2027-04-01",
      endDate: "2027-04-04",
      archived: false,
    });
  }

  it("offline: 'clubbing at night' adds late nights on most nights, without overlaps, and says so", async () => {
    const trip = await miami();
    const { events, summary } = await generateItinerary(trip, { preferences: "I want to go clubbing at night" });
    const nights = events.filter((e) => e.title.startsWith("Nightlife"));
    expect(nights.length).toBeGreaterThanOrEqual(3);
    for (const n of nights) {
      expect(n.start.slice(11, 16)).toBe("22:30");
      expect(n.end.slice(11, 16)).toBe("01:30");
      expect(n.end.slice(0, 10) > n.start.slice(0, 10)).toBe(true);
    }
    expect(nights.some((n) => n.end === "2027-04-05T01:30:00")).toBe(true); // the last night runs past the end date
    for (const a of events) for (const b of events) if (a !== b) expect(overlaps(a, b)).toBe(false);
    expect(summary.summary).toMatch(/nightlife/i);
    expect(summary.highlights.map((h) => h.title)).toContain("Nights out, as you asked");
  });

  it("offline: no nightlife unless asked", async () => {
    const { events } = await generateItinerary(await miami());
    expect(events.some((e) => e.end.slice(0, 10) > e.start.slice(0, 10))).toBe(false);
  });

  it("Gemini prompt allows nightlife and puts the request first-class", async () => {
    const trip = await miami();
    const { system, prompt } = buildPrompt({ trip, fixedEvents: [], bookings: [], preferences: "I want to go clubbing at night" }, buildConstraints({ trip, fixedEvents: [], bookings: [] }));
    expect(system).toMatch(/nightlife are allowed/);
    expect(system).toMatch(/up to 5/);
    expect(system).toMatch(/must clearly shape the plan/);
    expect(system).toContain("2027-04-05T01:30");
    expect(prompt).toContain("TRAVELER'S REQUEST (must shape the plan): I want to go clubbing at night");
  });
});

describe("offline nightlife summary reflects the final calendar", () => {
  it("counts nights out after post-processing, so a dropped night isn't claimed", async () => {
    const trip = await createTrip({
      userId: "demo-user",
      title: "Miami",
      destination: { name: "Miami, United States", scope: "city", timezone: "America/New_York" },
      startDate: "2027-04-01",
      endDate: "2027-04-04",
      archived: false,
    });
    // The traveler's own late plan on night 2 leaves no room for the planner's night out.
    await createEvents([{ tripId: trip.id, title: "Birthday party", start: "2027-04-02T22:00:00", end: "2027-04-03T02:30:00", source: "user" }]);
    const { events, summary } = await generateItinerary(trip, { preferences: "clubbing at night" });
    const nights = events.filter((e) => e.source === "ai" && e.title.startsWith("Nightlife in "));
    expect(nights).toHaveLength(3);
    expect(nights.some((n) => n.start.startsWith("2027-04-02"))).toBe(false);
    expect(summary.summary).not.toMatch(/every night/);
    expect(summary.summary).toContain("3 of 4 nights end with a night out");
    expect(summary.highlights.find((h) => h.title === "Nights out, as you asked")?.body).toContain("on 3 nights");
  });
});
