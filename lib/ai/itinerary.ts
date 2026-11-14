import { createEvents, deleteEventsWhere, listBookings, listEvents, saveSummary } from "../store/repo";
import type { ItinerarySummary, Trip, TripEvent } from "../types";
import type { GeminiDeps } from "./gemini";
import { planItinerary, type Plan } from "./planner";

/**
 * Generate / regenerate: plan first, then swap only `source: "ai"` events. User and booking events
 * are never touched, and a failed plan leaves the existing itinerary as it was.
 */
export async function generateItinerary(
  trip: Trip,
  opts: { preferences?: string; deps?: GeminiDeps } = {},
): Promise<{ events: TripEvent[]; summary: ItinerarySummary; plan: Plan }> {
  const [existing, bookings] = await Promise.all([listEvents(trip.id), listBookings(trip.id)]);
  const fixedEvents = existing.filter((e) => e.source !== "ai");
  const plan = await planItinerary({ trip, fixedEvents, bookings, preferences: opts.preferences }, opts.deps);

  await deleteEventsWhere({ tripId: trip.id, source: "ai" });
  await createEvents(
    plan.events.map((e) => ({
      tripId: trip.id,
      title: e.title,
      description: e.description,
      location: e.location,
      start: e.start,
      end: e.end,
      category: e.category,
      source: "ai" as const,
      aiReason: e.reason || undefined,
    })),
  );
  const summary = await saveSummary(trip.id, {
    summary: plan.summary,
    highlights: plan.highlights,
    mode: plan.mode,
    notice: plan.notice,
  });
  return { events: await listEvents(trip.id), summary, plan };
}
