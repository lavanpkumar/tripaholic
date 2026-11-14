import { z } from "zod";
import { bookFlight, bookLodging, defaultStay } from "../bookings";
import { hhmm } from "../dates";
import { findAirport, findRegion, nearestAirport } from "../geo";
import { getProviders, type FlightOption, type FlightQuery, type LodgingOption, type LodgingQuery } from "../providers";
import type { AgentKind, Booking, Trip } from "../types";

/**
 * The booking agent's tools (PLAN.md Section 6.2), shared by the Gemini and offline agents.
 * Each call returns a compact payload for the model plus a step for the UI log.
 */

export interface Proposal {
  optionId: string;
  option: FlightOption | LodgingOption;
  rationale: string;
  /** What booking it later needs: passengers for a flight, dates/guests for a stay. */
  passengers?: number;
  stay?: { checkIn: string; checkOut: string; guests: number };
}

export interface ToolOutcome {
  /** What the model sees as the function response. */
  response: Record<string, unknown>;
  /** What the UI step log shows. */
  summary: string;
  options?: FlightOption[] | LodgingOption[];
  booking?: Booking;
  error?: string;
  /** Stop the loop: booked, or waiting for the user to confirm. */
  stop?: "booked" | "awaiting_confirmation";
  proposal?: Proposal;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const hours = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

/** The airport a trip most likely flies into: the destination city, a state/country's first stop, or the nearest known airport. */
export function tripAirport(trip: Trip): { code: string; city: string } {
  const d = trip.destination;
  const direct = findAirport(d.name);
  if (direct && (d.scope === "city" || direct.country === d.country)) return { code: direct.iata, city: direct.city };
  const region = findRegion(d.name);
  const viaRegion = region && region.stops.map((s) => findAirport(s)).find(Boolean);
  if (viaRegion) return { code: viaRegion.iata, city: viaRegion.city };
  if (d.lat !== undefined && d.lng !== undefined) {
    const a = nearestAirport({ lat: d.lat, lng: d.lng }, d.country);
    return { code: a.iata, city: a.city };
  }
  return { code: d.name.split(",")[0], city: d.name.split(",")[0] };
}

export function compactFlight(o: FlightOption) {
  const leg = (l: FlightOption["outbound"]) => ({
    flight: l.flightNumber,
    route: `${l.from}→${l.to}`,
    depart: l.depart.slice(0, 16),
    arrive: l.arrive.slice(0, 16),
    duration: hours(l.durationMinutes),
    stops: l.stops,
    via: l.via,
  });
  return { id: o.id, airline: o.airline, priceTotalUSD: o.price, outbound: leg(o.outbound), inbound: o.inbound && leg(o.inbound), baggage: o.baggage, tags: o.tags };
}

export function compactStay(o: LodgingOption) {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    neighborhood: o.neighborhood,
    rating: o.rating,
    reviews: o.reviews,
    nightlyUSD: o.nightlyPrice,
    totalUSD: o.totalPrice,
    kmFromCenter: o.distanceKm,
    amenities: o.amenities,
    cancellation: o.cancellation,
    tags: o.tags,
  };
}

const searchFlightsArgs = z.object({
  origin: z.string().min(2),
  destination: z.string().min(2).optional(),
  departDate: z.string().optional(),
  returnDate: z.string().optional(),
  passengers: z.coerce.number().int().min(1).max(9).optional(),
  cabin: z.enum(["economy", "premium", "business"]).optional(),
});
const bookFlightArgs = z.object({ optionId: z.string(), rationale: z.string().optional() });
const searchLodgingArgs = z.object({
  location: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.coerce.number().int().min(1).max(16).optional(),
  budget: z.coerce.number().positive().optional(),
  type: z.enum(["hotel", "airbnb"]).optional(),
});
const bookLodgingArgs = z.object({ propertyId: z.string(), rationale: z.string().optional() });

/** JSON-schema tool declarations for Gemini function calling. */
export function toolDeclarations(kind: AgentKind) {
  if (kind === "flight")
    return [
      {
        name: "search_flights",
        description: "Search round-trip flights. Returns options with ids, prices (total USD for all passengers), local times, durations, stops.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            origin: { type: "string", description: "Origin IATA code or city, from the traveler's request" },
            destination: { type: "string", description: "Destination IATA code or city" },
            departDate: { type: "string", description: "YYYY-MM-DD, local at origin" },
            returnDate: { type: "string", description: "YYYY-MM-DD" },
            passengers: { type: "integer" },
            cabin: { type: "string", enum: ["economy", "premium", "business"] },
          },
          required: ["origin"],
        },
      },
      {
        name: "book_flight",
        description: "Book one option returned by search_flights.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            optionId: { type: "string" },
            rationale: { type: "string", description: "2-3 plain sentences: why this option, with concrete numbers" },
          },
          required: ["optionId", "rationale"],
        },
      },
    ];
  return [
    {
      name: "search_lodging",
      description: "Search hotels and Airbnb-style homes. Returns properties with ids, nightly and total prices (USD), ratings, location, amenities.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or neighborhood to stay in" },
          checkIn: { type: "string", description: "YYYY-MM-DD" },
          checkOut: { type: "string", description: "YYYY-MM-DD" },
          guests: { type: "integer" },
          budget: { type: "number", description: "Max nightly price in USD" },
          type: { type: "string", enum: ["hotel", "airbnb"] },
        },
      },
    },
    {
      name: "book_lodging",
      description: "Book one property returned by search_lodging, for the dates of that search.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          propertyId: { type: "string" },
          rationale: { type: "string", description: "2-3 plain sentences: why this property, with concrete numbers" },
        },
        required: ["propertyId", "rationale"],
      },
    },
  ];
}

export class Toolbox {
  private flights = new Map<string, FlightOption>();
  private stays = new Map<string, LodgingOption>();
  private lastFlightQuery?: FlightQuery;
  private lastStayQuery?: LodgingQuery;

  constructor(
    private trip: Trip,
    private autoBook: boolean,
  ) {}

  async exec(name: string, rawArgs: unknown): Promise<ToolOutcome> {
    try {
      switch (name) {
        case "search_flights":
          return await this.searchFlights(searchFlightsArgs.parse(rawArgs ?? {}));
        case "book_flight":
          return await this.bookFlight(bookFlightArgs.parse(rawArgs ?? {}));
        case "search_lodging":
          return await this.searchLodging(searchLodgingArgs.parse(rawArgs ?? {}));
        case "book_lodging":
          return await this.bookLodging(bookLodgingArgs.parse(rawArgs ?? {}));
        default:
          return this.fail(`Unknown tool ${name}`);
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? `Invalid arguments: ${err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` : (err as Error).message;
      return this.fail(msg);
    }
  }

  private fail(error: string): ToolOutcome {
    return { response: { error }, summary: `Error: ${error}`, error };
  }

  async searchFlights(a: z.infer<typeof searchFlightsArgs>): Promise<ToolOutcome> {
    const q: FlightQuery = {
      origin: a.origin,
      destination: a.destination ?? tripAirport(this.trip).code,
      departDate: a.departDate ?? this.trip.startDate,
      returnDate: a.returnDate ?? this.trip.endDate,
      passengers: a.passengers ?? 1,
      cabin: a.cabin,
    };
    const options = await getProviders().flights.search(q);
    for (const o of options) this.flights.set(o.id, o);
    this.lastFlightQuery = q;
    const prices = options.map((o) => o.price);
    return {
      response: { query: q, options: options.map(compactFlight) },
      summary: `${options.length} options ${options[0]?.outbound.from ?? q.origin} → ${options[0]?.outbound.to ?? q.destination}, ${money(Math.min(...prices))}–${money(Math.max(...prices))}`,
      options,
    };
  }

  async bookFlight(a: z.infer<typeof bookFlightArgs>): Promise<ToolOutcome> {
    const option = this.flights.get(a.optionId);
    if (!option) return this.fail(`Unknown optionId ${a.optionId}. Use an id from search_flights.`);
    const rationale = a.rationale ?? "";
    if (!this.autoBook) {
      return {
        response: { status: "awaiting_confirmation", optionId: option.id },
        summary: `Proposed ${option.airline} ${option.outbound.flightNumber} for ${money(option.price)}; waiting for your confirmation`,
        stop: "awaiting_confirmation",
        proposal: { optionId: option.id, option, rationale, passengers: this.lastFlightQuery?.passengers ?? 1 },
      };
    }
    const booking = await bookFlight(this.trip, option, this.lastFlightQuery?.passengers ?? 1, "agent", rationale);
    return {
      response: { status: "confirmed", confirmationCode: booking.confirmationCode, priceTotalUSD: booking.priceTotal },
      summary: `Booked ${option.airline} ${option.outbound.flightNumber}, lands ${hhmm(option.outbound.arrive)} · confirmation ${booking.confirmationCode}`,
      booking,
      stop: "booked",
    };
  }

  async searchLodging(a: z.infer<typeof searchLodgingArgs>): Promise<ToolOutcome> {
    const stay = defaultStay(this.trip, a.guests ?? 1);
    const q: LodgingQuery = {
      location: a.location ?? this.trip.destination.name,
      checkIn: a.checkIn ?? stay.checkIn,
      checkOut: a.checkOut ?? stay.checkOut,
      guests: a.guests ?? 1,
      budget: a.budget,
      type: a.type,
    };
    const options = await getProviders().lodging.search(q);
    for (const o of options) this.stays.set(o.id, o);
    this.lastStayQuery = q;
    const prices = options.map((o) => o.nightlyPrice);
    return {
      response: { query: q, options: options.map(compactStay) },
      summary: `${options.length} stays in ${q.location.split(",")[0]}, ${money(Math.min(...prices))}–${money(Math.max(...prices))}/night`,
      options,
    };
  }

  async bookLodging(a: z.infer<typeof bookLodgingArgs>): Promise<ToolOutcome> {
    const option = this.stays.get(a.propertyId);
    if (!option || !this.lastStayQuery) return this.fail(`Unknown propertyId ${a.propertyId}. Use an id from search_lodging.`);
    const rationale = a.rationale ?? "";
    if (!this.autoBook) {
      return {
        response: { status: "awaiting_confirmation", propertyId: option.id },
        summary: `Proposed ${option.name} for ${money(option.totalPrice)}; waiting for your confirmation`,
        stop: "awaiting_confirmation",
        proposal: {
          optionId: option.id,
          option,
          rationale,
          stay: { checkIn: this.lastStayQuery.checkIn, checkOut: this.lastStayQuery.checkOut, guests: this.lastStayQuery.guests },
        },
      };
    }
    const q = this.lastStayQuery;
    const booking = await bookLodging(this.trip, option, { checkIn: q.checkIn, checkOut: q.checkOut, guests: q.guests }, "agent", rationale);
    return {
      response: { status: "confirmed", confirmationCode: booking.confirmationCode, totalUSD: booking.priceTotal },
      summary: `Booked ${option.name}, ${option.nights} night${option.nights === 1 ? "" : "s"} · confirmation ${booking.confirmationCode}`,
      booking,
      stop: "booked",
    };
  }
}
