import { addMinutes } from "../dates";
import type { Booking, FlightBookingDetails, LodgingBookingDetails, Trip, TripEvent } from "../types";
import type { PlanConstraints } from "./postprocess";

/** Everything the planner knows about a trip, and the hard constraints derived from it. */

export interface PlannerContext {
  trip: Trip;
  /** Events the planner must keep: source "user" and "booking". */
  fixedEvents: TripEvent[];
  bookings: Booking[];
  preferences?: string;
}

/** Time to clear the airport and reach town after landing. */
export const ARRIVAL_BUFFER_MIN = 90;
/** Time to get to the airport before a departure. */
export const DEPARTURE_BUFFER_MIN = 150;

export interface DerivedConstraints extends PlanConstraints {
  arrival?: { at: string; flight: FlightBookingDetails };
  departure?: { at: string; flight: FlightBookingDetails };
  lodging: LodgingBookingDetails[];
}

export function buildConstraints(ctx: PlannerContext): DerivedConstraints {
  const { trip } = ctx;
  const flights = ctx.bookings.filter((b) => b.details.kind === "flight").map((b) => b.details as FlightBookingDetails);
  const lodging = ctx.bookings.filter((b) => b.details.kind === "lodging").map((b) => b.details as LodgingBookingDetails);
  const inTrip = (t: string) => t.slice(0, 10) >= trip.startDate && t.slice(0, 10) <= trip.endDate;

  // Latest arrival that lands within the trip, earliest departure from the destination.
  const arrival = flights
    .filter((f) => inTrip(f.arrivalAtDestination))
    .sort((a, b) => b.arrivalAtDestination.localeCompare(a.arrivalAtDestination))[0];
  const departure = flights
    .filter((f) => f.departureFromDestination && inTrip(f.departureFromDestination))
    .sort((a, b) => a.departureFromDestination!.localeCompare(b.departureFromDestination!))[0];

  return {
    startDate: trip.startDate,
    endDate: trip.endDate,
    fixed: ctx.fixedEvents.map((e) => ({ start: e.start, end: e.end })),
    earliest: arrival ? addMinutes(arrival.arrivalAtDestination, ARRIVAL_BUFFER_MIN) : undefined,
    latest: departure ? addMinutes(departure.departureFromDestination!, -DEPARTURE_BUFFER_MIN) : undefined,
    arrival: arrival ? { at: arrival.arrivalAtDestination, flight: arrival } : undefined,
    departure: departure ? { at: departure.departureFromDestination!, flight: departure } : undefined,
    lodging,
  };
}
