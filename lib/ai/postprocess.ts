import { addMinutes, localDate, minutesBetween, normalizeLocal } from "../dates";
import { overlaps, tripBounds } from "../events";
import { EVENT_CATEGORIES, type EventCategory } from "../types";

/**
 * Planner post-processing (PLAN.md Section 6.1). Whatever the planner returns, only events that
 * are inside the trip, outside the flight window, inside sensible daily hours, and not
 * overlapping fixed (user/booking) events or each other make it onto the calendar.
 * Pure functions: no I/O, fully unit tested.
 */

export interface PlannedEvent {
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  category: EventCategory;
  reason: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface PlanConstraints {
  startDate: string;
  endDate: string;
  /** User and booking events. Never moved or removed; AI events go around them. */
  fixed: TimeWindow[];
  /** Nothing may start before this (e.g. landing + transfer). */
  earliest?: string;
  /** Nothing may end after this (e.g. time to leave for the airport). */
  latest?: string;
  /** "HH:mm" bounds for regular events; travel events may go outside them. */
  dayStart?: string;
  dayEnd?: string;
  maxPerDay?: number;
}

export interface PostprocessResult {
  events: PlannedEvent[];
  dropped: number;
  moved: number;
}

const MIN_MINUTES = 15;
const MAX_MINUTES = 6 * 60;
const MAX_TRAVEL_MINUTES = 12 * 60;
const MAX_SHIFTS = 8;

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Validate and normalise one raw event; null if it is unusable. */
export function cleanEvent(raw: unknown): PlannedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 140);
  const start = typeof r.start === "string" ? normalizeLocal(r.start) : null;
  let end = typeof r.end === "string" ? normalizeLocal(r.end) : null;
  if (!title || !start || !end) return null;
  const category = (EVENT_CATEGORIES as readonly string[]).includes(r.category as string) ? (r.category as EventCategory) : "other";
  const minutes = minutesBetween(start, end);
  if (minutes < MIN_MINUTES) return null;
  const cap = category === "travel" ? MAX_TRAVEL_MINUTES : MAX_MINUTES;
  if (minutes > cap) end = addMinutes(start, cap);
  return {
    title,
    description: str(r.description, 2000),
    location: str(r.location, 200),
    start,
    end,
    category,
    reason: str(r.reason, 500) ?? "",
  };
}

function maxIso(a: string, b?: string) {
  return b && b > a ? b : a;
}
function minIso(a: string, b?: string) {
  return b && b < a ? b : a;
}

export function postprocessPlan(raw: unknown[], c: PlanConstraints): PostprocessResult {
  const bounds = tripBounds(c);
  const lo = maxIso(bounds.min, c.earliest);
  const hi = minIso(bounds.max, c.latest);
  const dayStart = c.dayStart ?? "07:00";
  const dayEnd = c.dayEnd ?? "23:00";
  const maxPerDay = c.maxPerDay ?? 5;

  const cleaned = raw.map(cleanEvent);
  let dropped = cleaned.filter((e) => !e).length;
  let moved = 0;
  const candidates = (cleaned.filter(Boolean) as PlannedEvent[]).sort((a, b) => a.start.localeCompare(b.start));

  const accepted: PlannedEvent[] = [];
  const perDay = new Map<string, number>();

  for (const ev of candidates) {
    const duration = minutesBetween(ev.start, ev.end);
    const day = localDate(ev.start);
    const isTravel = ev.category === "travel";
    // Latest moment this event may end on its own day.
    const dayLimit = minIso(isTravel ? `${day}T23:59:00` : `${day}T${dayEnd}:00`, hi);
    let start = ev.start;
    if (!isTravel && start < `${day}T${dayStart}:00`) start = `${day}T${dayStart}:00`;
    if (start < lo) start = lo;

    let placed: PlannedEvent | null = null;
    for (let i = 0; i < MAX_SHIFTS; i++) {
      const end = addMinutes(start, duration);
      if (localDate(start) !== day || end > dayLimit || start < lo) break;
      const blocker = [...c.fixed, ...accepted].find((w) => overlaps({ start, end }, w));
      if (!blocker) {
        placed = { ...ev, start, end };
        break;
      }
      start = blocker.end;
    }
    if (!placed || (perDay.get(day) ?? 0) >= maxPerDay) {
      dropped++;
      continue;
    }
    if (placed.start !== ev.start) moved++;
    accepted.push(placed);
    accepted.sort((a, b) => a.start.localeCompare(b.start));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  return { events: accepted, dropped, moved };
}
