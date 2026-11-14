// Shared domain types. Mirrors PLAN.md Section 5; all ids are strings at the API boundary.

export type Scope = "city" | "state" | "country";
export const SCOPES: readonly Scope[] = ["city", "state", "country"] as const;

export interface Destination {
  /** Location the user typed / picked, e.g. "Tokyo, Japan". */
  name: string;
  scope: Scope;
  lat?: number;
  lng?: number;
  /** IANA zone, e.g. "Asia/Tokyo". */
  timezone: string;
  country?: string;
  region?: string;
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  destination: Destination;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = "planned" | "in_progress" | "archived";
export type TripWithStatus = Trip & { status: TripStatus };

export const EVENT_CATEGORIES = ["food", "sight", "activity", "travel", "lodging", "other"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventSource = "ai" | "user" | "booking";

/**
 * Itinerary event. `start`/`end` are *floating* local ISO datetimes ("2027-02-08T09:00:00", no offset)
 * expressed in the destination's wall-clock time. See DECISIONS.md.
 */
export interface TripEvent {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  category?: EventCategory;
  source: EventSource;
  aiReason?: string;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItinerarySummary {
  id: string;
  tripId: string;
  summary: string;
  /** 2-3 short "why" themes shown as headed paragraphs in the SummaryPanel. */
  highlights: { title: string; body: string }[];
  generatedAt: string;
  mode: "gemini" | "offline";
  /** Set when Gemini failed and the offline planner produced this plan. */
  notice?: string;
}

export type BookingType = "flight" | "lodging";

export interface Booking {
  id: string;
  tripId: string;
  type: BookingType;
  status: "confirmed";
  provider: string;
  confirmationCode: string;
  details: FlightBookingDetails | LodgingBookingDetails;
  priceTotal: number;
  currency: string;
  bookedBy: "agent" | "user";
  rationale?: string;
  createdAt: string;
}

export interface FlightLeg {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  /** floating local time at the departure airport */
  depart: string;
  /** floating local time at the arrival airport */
  arrive: string;
  durationMinutes: number;
  stops: number;
  via?: string;
}

export interface FlightBookingDetails {
  kind: "flight";
  optionId: string;
  airline: string;
  cabin: string;
  passengers: number;
  outbound: FlightLeg;
  inbound?: FlightLeg;
  /** Leg times expressed in destination wall-clock time, used for calendar blocks + planner constraints. */
  arrivalAtDestination: string;
  departureFromDestination?: string;
}

export interface LodgingBookingDetails {
  kind: "lodging";
  propertyId: string;
  name: string;
  type: "hotel" | "airbnb";
  neighborhood: string;
  address: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  nightlyPrice: number;
  rating: number;
}

export type AgentKind = BookingType;
export type AgentStepType = "thought" | "tool_call" | "tool_result" | "final";

export interface AgentStep {
  type: AgentStepType;
  content: unknown;
  at: string;
}

export interface AgentFinal {
  status: "booked" | "awaiting_confirmation" | "failed";
  message: string;
  booking?: Booking;
  proposal?: { optionId: string; option: unknown; rationale: string };
}

export interface AgentRun {
  id: string;
  tripId: string;
  kind: AgentKind;
  userRequest: string;
  autoBook: boolean;
  mode: "gemini" | "offline";
  steps: AgentStep[];
  createdAt: string;
}
