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

/** Inclusive start / exclusive end bounds of a trip in floating local time. */
export function tripBounds(trip: Pick<Trip, "startDate" | "endDate">): { min: string; max: string } {
  return { min: `${trip.startDate}T00:00:00`, max: `${addDays(trip.endDate, 1)}T00:00:00` };
}

export function withinTrip(trip: Pick<Trip, "startDate" | "endDate">, start: string, end: string): boolean {
  const { min, max } = tripBounds(trip);
  return start >= min && end <= max && end > start;
}

export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && b.start < a.end;
}
