import { HttpError } from "../api";
import { createEvents, deleteEventsByIds, listBookings, listEvents, saveSummary } from "../store/repo";
import type { ItinerarySummary, Trip, TripEvent } from "../types";
import type { GeminiDeps } from "./gemini";
import { planItinerary, type Plan } from "./planner";

/** One generate per trip at a time (two tabs or a retry would otherwise interleave delete/insert). */
const g = globalThis as unknown as { __planLocks?: Set<string> };
const locks = (g.__planLocks ??= new Set<string>());

/**
 * Generate / regenerate. Fixed events (user, booking, and pinned AI events the traveler moved or
 * edited) are never touched and constrain the plan. The new plan is written before the old AI
 * events are removed, so a failure part-way never leaves the trip with no plan.
 */
export async function generateItinerary(
  trip: Trip,
  opts: { preferences?: string; deps?: GeminiDeps } = {},
): Promise<{ events: TripEvent[]; summary: ItinerarySummary; plan: Plan }> {
  if (locks.has(trip.id)) throw new HttpError(409, "A plan is already being generated for this trip. Give it a moment.");
  locks.add(trip.id);
  try {
    const [existing, bookings] = await Promise.all([listEvents(trip.id), listBookings(trip.id)]);
    const fixedEvents = existing.filter((e) => e.source !== "ai" || e.pinned);
    const replaceable = existing.filter((e) => e.source === "ai" && !e.pinned).map((e) => e.id);
    const plan = await planItinerary({ trip, fixedEvents, bookings, preferences: opts.preferences }, opts.deps);

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
    await deleteEventsByIds(replaceable);
    const summary = await saveSummary(trip.id, {
      summary: plan.summary,
      highlights: plan.highlights,
      mode: plan.mode,
      notice: plan.notice,
    });
    return { events: await listEvents(trip.id), summary, plan };
  } finally {
    locks.delete(trip.id);
  }
}
