import type { FlightLeg } from "../types";

/** Provider interfaces (PLAN.md Section 7). The agent only ever talks to these. */

export interface FlightQuery {
  /** IATA code or city name */
  origin: string;
  destination: string;
  /** YYYY-MM-DD, local at origin */
  departDate: string;
  returnDate?: string;
  passengers: number;
  cabin?: "economy" | "premium" | "business";
  preferences?: string;
}

export interface FlightOption {
  /** Unique to this search result (changes with the query). */
  id: string;
  /** Stable identity across searches: airline + cabin + every leg's flight number and departure. */
  key: string;
  airline: string;
  cabin: string;
  /** Total for all passengers, round trip if inbound is present. */
  price: number;
  currency: string;
  outbound: FlightLeg;
  inbound?: FlightLeg;
  baggage: string;
  /** Destination time zone, used to place the flight on the itinerary. */
  destinationTz: string;
  originTz: string;
  tags: string[];
}

export interface LodgingQuery {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Max nightly price in USD */
  budget?: number;
  type?: "hotel" | "airbnb";
  preferences?: string;
}

export interface LodgingOption {
  /** Unique to this search result (changes with the query). */
  id: string;
  /** Stable identity across searches: the property itself. */
  key: string;
  name: string;
  type: "hotel" | "airbnb";
  neighborhood: string;
  address: string;
  rating: number;
  reviews: number;
  nightlyPrice: number;
  totalPrice: number;
  nights: number;
  currency: string;
  amenities: string[];
  distanceKm: number;
  cancellation: string;
  photo: string;
  tags: string[];
}

export interface ProviderConfirmation {
  confirmationCode: string;
  provider: string;
}

export interface FlightProvider {
  name: string;
  search(q: FlightQuery): Promise<FlightOption[]>;
  /** Takes the full option (not only its id) so stateless providers can book what was shown. */
  book(option: FlightOption, passengers: number): Promise<ProviderConfirmation>;
}

export interface LodgingProvider {
  name: string;
  search(q: LodgingQuery): Promise<LodgingOption[]>;
  book(option: LodgingOption, stay: { checkIn: string; checkOut: string; guests: number }): Promise<ProviderConfirmation>;
}
