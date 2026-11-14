import { todayIn } from "./dates";
import type { Trip, TripStatus, TripWithStatus } from "./types";

/**
 * Status is derived, never stored (PLAN.md Section 5):
 *   archived || today > endDate  -> "archived"
 *   today >= startDate           -> "in_progress"
 *   else                         -> "planned"
 * `today` is evaluated in the destination's time zone, since that is where the trip happens.
 */
export function deriveStatus(
  trip: Pick<Trip, "archived" | "startDate" | "endDate">,
  today: string,
): TripStatus {
  if (trip.archived || today > trip.endDate) return "archived";
  if (today >= trip.startDate) return "in_progress";
  return "planned";
}

export function withStatus(trip: Trip, now: Date = new Date()): TripWithStatus {
  return { ...trip, status: deriveStatus(trip, todayIn(trip.destination.timezone, now)) };
}
