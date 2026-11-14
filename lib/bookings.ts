import { addDays, addMinutes, hhmm } from "./dates";
import { tripBounds } from "./events";
import { getProviders, type FlightOption, type LodgingOption } from "./providers";
import { createBooking, createEvents, listBookings, listEvents, updateEvent, type NewEvent } from "./store/repo";
import type { Booking, FlightBookingDetails, FlightLeg, LodgingBookingDetails, Trip } from "./types";

/**
 * Turns a chosen option into a confirmed booking: calls the provider, writes the `bookings`
 * record, and adds `source: "booking"` blocks to the itinerary (PLAN.md Section 6.2).
 */

function clampToTrip(trip: Trip, start: string, end: string): { start: string; end: string } | null {
  const { min, max } = tripBounds(trip);
  const s = start < min ? min : start;
  const e = end > max ? max : end;
  return e > s ? { start: s, end: e } : null;
}

/** Flight block in destination wall-clock time, clipped to the day and the trip. */
function legBlock(trip: Trip, leg: FlightLeg, startLocal: string, endLocal: string, title: string, description: string, bookingId: string): NewEvent | null {
  const window = clampToTrip(trip, startLocal, endLocal);
  if (!window) return null;
  return { tripId: trip.id, title, description, start: window.start, end: window.end, category: "travel", source: "booking", bookingId, location: leg.to };
}

export async function bookFlight(
  trip: Trip,
  option: FlightOption,
  passengers: number,
  bookedBy: Booking["bookedBy"],
  rationale?: string,
): Promise<Booking> {
  const { flights } = getProviders();
  const conf = await flights.book(option, passengers);
  const out = option.outbound;
  const inb = option.inbound;
  // Inbound departs from the destination, so its depart time is already destination-local.
  const details: FlightBookingDetails = {
    kind: "flight",
    optionId: option.id,
    airline: option.airline,
    cabin: option.cabin,
    passengers,
    outbound: out,
    inbound: inb,
    arrivalAtDestination: out.arrive,
    departureFromDestination: inb?.depart,
  };
  const booking = await createBooking({
    tripId: trip.id,
    type: "flight",
    status: "confirmed",
    provider: conf.provider,
    confirmationCode: conf.confirmationCode,
    details,
    priceTotal: option.price,
    currency: option.currency,
    bookedBy,
    rationale,
  });

  const blocks: (NewEvent | null)[] = [];
  // Outbound: the last stretch before landing (at most BLOCK_MINUTES), in destination time, clipped to the trip.
  blocks.push(
    legBlock(
      trip,
      out,
      addMinutes(out.arrive, -Math.min(out.durationMinutes, BLOCK_MINUTES)),
      out.arrive,
      `${out.flightNumber} lands at ${out.to} ${hhmm(out.arrive)}`,
      `${option.airline} ${out.flightNumber}, ${out.from} → ${out.to}${out.via ? ` via ${out.via}` : ""}. Confirmation ${conf.confirmationCode}.`,
      booking.id,
    ),
  );
  if (inb) {
    blocks.push(
      legBlock(
        trip,
        inb,
        inb.depart,
        addMinutes(inb.depart, Math.min(inb.durationMinutes, BLOCK_MINUTES)),
        `${inb.flightNumber} departs ${inb.from} ${hhmm(inb.depart)}`,
        `${option.airline} ${inb.flightNumber}, ${inb.from} → ${inb.to}${inb.via ? ` via ${inb.via}` : ""}. Leave for the airport about 2.5 hours before. Confirmation ${conf.confirmationCode}.`,
        booking.id,
      ),
    );
  }
  await createEvents(blocks.filter((b): b is NewEvent => Boolean(b)));
  await reconcileCheckIn(trip);
  return booking;
}

export async function bookLodging(
  trip: Trip,
  option: LodgingOption,
  stay: { checkIn: string; checkOut: string; guests: number },
  bookedBy: Booking["bookedBy"],
  rationale?: string,
): Promise<Booking> {
  const { lodging } = getProviders();
  const conf = await lodging.book(option, stay);
  const details: LodgingBookingDetails = {
    kind: "lodging",
    propertyId: option.id,
    name: option.name,
    type: option.type,
    neighborhood: option.neighborhood,
    address: option.address,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: option.nights,
    guests: stay.guests,
    nightlyPrice: option.nightlyPrice,
    rating: option.rating,
  };
  const booking = await createBooking({
    tripId: trip.id,
    type: "lodging",
    status: "confirmed",
    provider: conf.provider,
    confirmationCode: conf.confirmationCode,
    details,
    priceTotal: option.totalPrice,
    currency: option.currency,
    bookedBy,
    rationale,
  });

  const blocks: (NewEvent | null)[] = [];
  const checkIn = clampToTrip(trip, `${stay.checkIn}T15:00:00`, `${stay.checkIn}T16:00:00`);
  if (checkIn)
    blocks.push({
      tripId: trip.id,
      title: `Check in: ${option.name}`,
      description: `${option.address}. Confirmation ${conf.confirmationCode}.`,
      ...checkIn,
      category: "lodging",
      source: "booking",
      bookingId: booking.id,
      location: option.neighborhood,
    });
  const checkOut = stay.checkOut <= trip.endDate ? clampToTrip(trip, `${stay.checkOut}T10:00:00`, `${stay.checkOut}T11:00:00`) : null;
  if (checkOut)
    blocks.push({
      tripId: trip.id,
      title: `Check out: ${option.name}`,
      description: `Confirmation ${conf.confirmationCode}.`,
      ...checkOut,
      category: "lodging",
      source: "booking",
      bookingId: booking.id,
      location: option.neighborhood,
    });
  await createEvents(blocks.filter((b): b is NewEvent => Boolean(b)));
  await reconcileCheckIn(trip);
  return booking;
}

/** How long a flight block shows on the calendar (the full flight would swamp a day). */
const BLOCK_MINUTES = 120;
/** Landing to hotel door. */
const TRANSFER_MINUTES = 90;

/** Hotel door to the airport, plus check-in time there. */
const AIRPORT_MINUTES = 150;

function roundDownQuarter(local: string): string {
  const m = Number(local.slice(14, 16));
  return `${addMinutes(local, -(m % 15)).slice(0, 16)}:00`;
}

function roundUpQuarter(local: string): string {
  const m = Number(local.slice(14, 16));
  const up = (15 - (m % 15)) % 15;
  return `${addMinutes(local, up).slice(0, 16)}:00`;
}

/**
 * Keep hotel blocks consistent with flights, whichever was booked first: check-in no earlier than
 * landing + transfer, check-out no later than leaving for the airport.
 */
export async function reconcileCheckIn(trip: Trip): Promise<void> {
  const flights = (await listBookings(trip.id)).filter((b) => b.details.kind === "flight").map((b) => b.details as FlightBookingDetails);
  if (!flights.length) return;
  const events = await listEvents(trip.id);
  for (const ev of events) {
    if (ev.source !== "booking" || ev.category !== "lodging") continue;
    if (ev.title.startsWith("Check out")) {
      const day = ev.start.slice(0, 10);
      const leaving = flights.map((f) => f.departureFromDestination).filter((d): d is string => Boolean(d) && d!.slice(0, 10) === day).sort()[0];
      if (!leaving) continue;
      const end = roundDownQuarter(addMinutes(leaving, -AIRPORT_MINUTES));
      if (ev.end <= end) continue;
      const start = addMinutes(end, -30);
      if (start.slice(0, 10) !== day) continue;
      await updateEvent(ev.id, { start, end });
      continue;
    }
    if (!ev.title.startsWith("Check in")) continue;
    const day = ev.start.slice(0, 10);
    const landing = flights.map((f) => f.arrivalAtDestination).filter((a) => a.slice(0, 10) === day).sort().at(-1);
    if (!landing) continue;
    const earliest = roundUpQuarter(addMinutes(landing, TRANSFER_MINUTES));
    if (ev.start >= earliest) continue;
    const end = addMinutes(earliest, 60);
    if (end.slice(0, 10) !== day) continue;
    await updateEvent(ev.id, { start: earliest, end });
  }
}

/** Default stay: check in on day one, check out on the last morning (one night minimum). */
export function defaultStay(trip: Trip, guests = 1) {
  return { checkIn: trip.startDate, checkOut: trip.endDate > trip.startDate ? trip.endDate : addDays(trip.endDate, 1), guests };
}
