import { addDays } from "./dates";
import type { EventCategory, Trip, TripEvent } from "./types";

/** Event helpers shared by API routes, the planner, and the calendar UI (no server-only imports). */

export type EventKind = "sight" | "activity" | "food" | "travel" | "user";

export function eventKind(e: Pick<TripEvent, "source" | "category">): EventKind {
  if (e.source === "user") return "user";
  if (e.source === "booking") return "travel";
  switch (e.category) {
    case "sight":
      return "sight";
    case "food":
      return "food";
    case "travel":
    case "lodging":
      return "travel";
    default:
      return "activity";
  }
}

export const KIND_LABEL: Record<EventKind, string> = {
  sight: "Sights & culture",
  activity: "Activities & nature",
  food: "Food & drink",
  travel: "Travel & stays",
  user: "Your events",
};

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  sight: "Sight",
  activity: "Activity",
  food: "Food",
  travel: "Travel",
  lodging: "Lodging",
  other: "Other",
};

/** Evening events (starting at or after this) may run past midnight... */
export const EVENING_START = "18:00";
/** ...until this time the next morning. */
export const NIGHT_END = "03:00";

/**
 * Bounds of a trip in floating local time. Events must start on a trip day (`min` <= start <
 * `lastStart`), and may end as late as `max`: 03:00 after the last day, so the last night out
 * is not cut off at midnight.
 */
export function tripBounds(trip: Pick<Trip, "startDate" | "endDate">): { min: string; max: string; lastStart: string } {
  const after = addDays(trip.endDate, 1);
  return { min: `${trip.startDate}T00:00:00`, max: `${after}T${NIGHT_END}:00`, lastStart: `${after}T00:00:00` };
}

export function withinTrip(trip: Pick<Trip, "startDate" | "endDate">, start: string, end: string): boolean {
  const { min, max, lastStart } = tripBounds(trip);
  return start >= min && start < lastStart && end <= max && end > start;
}

/** True if the event ends on a later calendar day than it starts. */
export function crossesMidnight(e: { start: string; end: string }): boolean {
  return e.end.slice(0, 10) > e.start.slice(0, 10) && e.end.slice(11, 19) !== "00:00:00";
}

export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && b.start < a.end;
}
