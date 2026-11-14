import { hhmm } from "../dates";
import { AIRPORTS, airportByCode } from "../geo";
import type { FlightOption, LodgingOption } from "../providers";

/** Request parsing and option ranking for the offline agent. Pure and unit tested. */

export interface FlightPrefs {
  origin?: string;
  passengers: number;
  goal: "cheapest" | "fastest" | "balanced";
  nonstop: boolean;
  arriveBefore?: string;
  departAfter?: string;
  avoidRedEye: boolean;
  cabin?: "economy" | "premium" | "business";
}

export interface StayPrefs {
  guests: number;
  goal: "cheapest" | "top_rated" | "central" | "balanced";
  type?: "hotel" | "airbnb";
  budget?: number;
  minRating?: number;
  amenities: string[];
  area?: string;
}

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function count(text: string, nouns: string): number | undefined {
  const m = text.match(new RegExp(`\\b(\\d+|one|two|three|four|five|six)\\s+(?:${nouns})\\b`, "i"));
  if (!m) return undefined;
  return Number(m[1]) || NUM_WORDS[m[1].toLowerCase()];
}

/** "noon" | "11am" | "11:30 am" | "14:00" -> "HH:mm" */
export function parseClock(s: string): string | undefined {
  const t = s.trim().toLowerCase();
  if (t === "noon" || t === "midday") return "12:00";
  if (t === "midnight") return "00:00";
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  const ap = m[3]?.replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23) return undefined;
  return `${String(h).padStart(2, "0")}:${min}`;
}

const CLOCK = "(noon|midday|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?)";

export function parseFlightRequest(text: string): FlightPrefs {
  const t = text.toLowerCase();
  let origin: string | undefined;
  const codes = [...text.matchAll(/\b([A-Z]{3})\b/g)].map((m) => m[1]).filter((c) => airportByCode(c));
  const from = text.match(/\bfrom\s+([A-Za-z][A-Za-z .'-]*?)(?=\s+(?:to|on|arriv\w*|land\w*|leav\w*|depart\w*|in|for|and|with|before|after|that|which)\b|[,.!?]|$)/i);
  if (from) {
    const raw = from[1].trim();
    const code = raw.toUpperCase();
    origin = airportByCode(code)?.iata ?? AIRPORTS.find((a) => a.city.toLowerCase() === raw.toLowerCase())?.iata ?? raw;
  } else if (codes.length) origin = codes[0];

  const arrive = t.match(new RegExp(`(?:arriv\\w*|land\\w*|get(?:ting)? there)\\s+(?:by|before|no later than)\\s+${CLOCK}`));
  const depart = t.match(new RegExp(`(?:leav\\w*|depart\\w*)\\s+after\\s+${CLOCK}`));
  return {
    origin,
    passengers: count(t, "adults?|people|passengers|travell?ers|of us") ?? 1,
    goal: /\b(cheap\w*|budget|lowest|least expensive|save)\b/.test(t) ? "cheapest" : /\b(fast\w*|quick\w*|shortest)\b/.test(t) ? "fastest" : "balanced",
    nonstop: /\b(direct|non-?stop|no (?:layovers?|stops?|connections?))\b/.test(t),
    arriveBefore: arrive ? parseClock(arrive[1]) : /\barriv\w* in the morning\b/.test(t) ? "12:00" : undefined,
    departAfter: depart ? parseClock(depart[1]) : undefined,
    avoidRedEye: /\b(no|avoid|not a|without)\s+red-?eyes?\b/.test(t),
    cabin: /\bbusiness\b/.test(t) ? "business" : /\bpremium\b/.test(t) ? "premium" : undefined,
  };
}

const AMENITY_WORDS: [RegExp, string][] = [
  [/\bpool\b/, "Pool"],
  [/\bbreakfast\b/, "Breakfast included"],
  [/\bgym|fitness\b/, "Gym"],
  [/\bspa\b/, "Spa"],
  [/\bkitchen\b/, "Kitchen"],
  [/\bwi-?fi|internet\b/, "Free Wi-Fi"],
  [/\bparking\b/, "Parking"],
  [/\bwork ?space|desk\b/, "Workspace"],
];

export function parseStayRequest(text: string): StayPrefs {
  const t = text.toLowerCase();
  const budget = t.match(/(?:under|below|less than|max(?:imum)?|up to|no more than|budget(?: of)?)\s*\$?\s*(\d{2,4})/) ?? t.match(/\$\s*(\d{2,4})\s*(?:\/|per|a)\s*night/);
  const rating = t.match(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|rating|rated)/) ?? t.match(/rated\s+(?:at least|over|above)\s+(\d(?:\.\d)?)/);
  const area = text.match(/\b(?:near|close to|in)\s+(?:the\s+)?([A-Z][\w' -]+?)(?=[,.!?]|\s+(?:with|for|under|and|that)\b|$)/);
  return {
    guests: count(t, "adults?|people|guests|travell?ers|of us") ?? 1,
    goal: /\b(cheap\w*|budget|lowest|least expensive)\b/.test(t)
      ? "cheapest"
      : /\b(best|top|highest)[- ]rated|\bluxur\w*/.test(t)
        ? "top_rated"
        : /\b(central|center|centre|downtown|walkable|near the center)\b/.test(t)
          ? "central"
          : "balanced",
    type: /\b(airbnb|apartment|flat|villa|home|house|condo)\b/.test(t) ? "airbnb" : /\bhotel\b/.test(t) ? "hotel" : undefined,
    budget: budget ? Number(budget[1]) : undefined,
    minRating: rating ? Number(rating[1]) : undefined,
    amenities: AMENITY_WORDS.filter(([re]) => re.test(t)).map(([, a]) => a),
    area: area?.[1]?.trim(),
  };
}

export interface Ranked<T> {
  best?: T;
  eligible: T[];
  /** Human-readable filters applied, and any that had to be relaxed. */
  applied: string[];
  relaxed: string[];
}

function applyFilters<T>(options: T[], filters: [string, (o: T) => boolean][]): Ranked<T> {
  let pool = options;
  const applied: string[] = [];
  const relaxed: string[] = [];
  for (const [label, keep] of filters) {
    const next = pool.filter(keep);
    if (next.length) {
      pool = next;
      applied.push(label);
    } else relaxed.push(label);
  }
  return { eligible: pool, applied, relaxed };
}

/**
 * `arriveOn` anchors "arrive before noon" to a day (the trip's first day), so a red-eye landing
 * at 01:30 two days later does not count. Without it, overnight arrivals (before 05:00) are excluded.
 */
export function rankFlights(options: FlightOption[], p: FlightPrefs, arriveOn?: string): Ranked<FlightOption> {
  const filters: [string, (o: FlightOption) => boolean][] = [];
  if (p.nonstop) filters.push(["nonstop", (o) => o.outbound.stops === 0]);
  if (p.arriveBefore)
    filters.push(
      arriveOn
        ? [`lands by ${p.arriveBefore} on ${arriveOn.slice(5)}`, (o) => o.outbound.arrive <= `${arriveOn}T${p.arriveBefore}:00`]
        : [`lands before ${p.arriveBefore}`, (o) => hhmm(o.outbound.arrive) >= "05:00" && hhmm(o.outbound.arrive) <= p.arriveBefore!],
    );
  if (p.departAfter) filters.push([`leaves after ${p.departAfter}`, (o) => hhmm(o.outbound.depart) >= p.departAfter!]);
  if (p.avoidRedEye) filters.push(["no red-eye", (o) => !o.tags.includes("Red-eye")]);
  const r = applyFilters(options, filters);
  const score = (o: FlightOption) =>
    p.goal === "cheapest" ? o.price : p.goal === "fastest" ? o.outbound.durationMinutes : o.price + (o.outbound.durationMinutes / 60) * 45 + o.outbound.stops * 80;
  r.eligible.sort((a, b) => score(a) - score(b));
  return { ...r, best: r.eligible[0] };
}

export function rankStays(options: LodgingOption[], p: StayPrefs): Ranked<LodgingOption> {
  const filters: [string, (o: LodgingOption) => boolean][] = [];
  if (p.type) filters.push([p.type === "airbnb" ? "entire home" : "hotel", (o) => o.type === p.type]);
  if (p.budget) filters.push([`under $${p.budget}/night`, (o) => o.nightlyPrice <= p.budget!]);
  if (p.minRating) filters.push([`rated ${p.minRating}+`, (o) => o.rating >= p.minRating!]);
  for (const a of p.amenities) filters.push([a.toLowerCase(), (o) => o.amenities.includes(a)]);
  const r = applyFilters(options, filters);
  const score = (o: LodgingOption) =>
    p.goal === "cheapest"
      ? o.nightlyPrice
      : p.goal === "top_rated"
        ? -o.rating * 1000 + o.nightlyPrice * 0.01
        : p.goal === "central"
          ? o.distanceKm * 100 + o.nightlyPrice * 0.05
          : o.nightlyPrice * 0.5 - o.rating * 60 + o.distanceKm * 10;
  r.eligible.sort((a, b) => score(a) - score(b));
  return { ...r, best: r.eligible[0] };
}
