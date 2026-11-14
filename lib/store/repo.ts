import { randomUUID } from "node:crypto";
import { coll } from "./index";
import type { AgentRun, AgentStep, Booking, ItinerarySummary, Trip, TripEvent } from "../types";

/** Data access for every collection. API routes, the agent, and scripts all go through here. */

const now = () => new Date().toISOString();
export const newId = () => randomUUID();

const trips = () => coll<Trip>("trips");
const events = () => coll<TripEvent>("events");
const summaries = () => coll<ItinerarySummary>("itinerarySummaries");
const bookings = () => coll<Booking>("bookings");
const runs = () => coll<AgentRun>("agentRuns");

// ---------- trips ----------

export async function listTrips(userId: string): Promise<Trip[]> {
  return trips().find({ userId }, { startDate: 1 });
}

export async function getTrip(id: string, userId: string): Promise<Trip | null> {
  return trips().findOne({ id, userId });
}

export async function createTrip(input: Omit<Trip, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Trip> {
  const t = now();
  const trip: Trip = { ...input, id: input.id ?? newId(), createdAt: t, updatedAt: t };
  await trips().insertMany([trip]);
  return trip;
}

export async function updateTrip(id: string, patch: Partial<Trip>): Promise<Trip | null> {
  return trips().update(id, { ...patch, updatedAt: now() });
}

/** Deletes the trip and everything hanging off it. */
export async function deleteTrip(id: string): Promise<void> {
  await Promise.all([
    events().deleteMany({ tripId: id }),
    summaries().deleteMany({ tripId: id }),
    bookings().deleteMany({ tripId: id }),
    runs().deleteMany({ tripId: id }),
  ]);
  await trips().deleteMany({ id });
}

// ---------- events ----------

export async function listEvents(tripId: string): Promise<TripEvent[]> {
  return events().find({ tripId }, { start: 1 });
}

export async function getEvent(id: string): Promise<TripEvent | null> {
  return events().findOne({ id });
}

export type NewEvent = Omit<TripEvent, "id" | "createdAt" | "updatedAt">;

export async function createEvents(input: NewEvent[]): Promise<TripEvent[]> {
  const t = now();
  const docs = input.map((e) => ({ ...e, id: newId(), createdAt: t, updatedAt: t }));
  await events().insertMany(docs);
  return docs;
}

export async function updateEvent(id: string, patch: Partial<TripEvent>): Promise<TripEvent | null> {
  return events().update(id, { ...patch, updatedAt: now() });
}

export async function deleteEvent(id: string): Promise<boolean> {
  return (await events().deleteMany({ id })) > 0;
}

export async function deleteEventsWhere(filter: Partial<TripEvent>): Promise<number> {
  return events().deleteMany(filter);
}

// ---------- itinerary summaries ----------

export async function getSummary(tripId: string): Promise<ItinerarySummary | null> {
  return summaries().findOne({ tripId });
}

export async function saveSummary(tripId: string, s: Omit<ItinerarySummary, "id" | "tripId" | "generatedAt">): Promise<ItinerarySummary> {
  await summaries().deleteMany({ tripId });
  const doc: ItinerarySummary = { ...s, id: newId(), tripId, generatedAt: now() };
  await summaries().insertMany([doc]);
  return doc;
}

// ---------- bookings ----------

export async function listBookings(tripId: string): Promise<Booking[]> {
  return bookings().find({ tripId }, { createdAt: 1 });
}

export async function getBooking(id: string): Promise<Booking | null> {
  return bookings().findOne({ id });
}

export async function createBooking(b: Omit<Booking, "id" | "createdAt">): Promise<Booking> {
  const doc: Booking = { ...b, id: newId(), createdAt: now() };
  await bookings().insertMany([doc]);
  return doc;
}

export async function deleteBooking(id: string): Promise<void> {
  await events().deleteMany({ bookingId: id });
  await bookings().deleteMany({ id });
}

// ---------- agent runs ----------

export async function createRun(r: Omit<AgentRun, "id" | "createdAt" | "steps">): Promise<AgentRun> {
  const doc: AgentRun = { ...r, id: newId(), steps: [], createdAt: now() };
  await runs().insertMany([doc]);
  return doc;
}

export async function appendStep(runId: string, step: AgentStep): Promise<void> {
  await runs().push(runId, "steps", step);
}

export async function getRun(id: string): Promise<AgentRun | null> {
  return runs().findOne({ id });
}

export async function latestRun(tripId: string, kind: AgentRun["kind"]): Promise<AgentRun | null> {
  const all = await runs().find({ tripId, kind }, { createdAt: -1 });
  return all[0] ?? null;
}
