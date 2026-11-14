import { addMinutes, convertLocal } from "../dates";
import { airportByCode, findAirport, haversineKm, type Airport } from "../geo";
import type { FlightLeg } from "../types";
import { confirmationCode, hashString, seeded } from "./random";
import type { FlightOption, FlightProvider, FlightQuery } from "./types";

/**
 * Deterministic mock flight search: the same query always returns the same 8 options, with
 * real tradeoffs (nonstop vs. layovers, a red-eye, a budget fare, an expensive fast one) so the
 * agent has something to reason about. Airlines are fictional; the UI labels this demo data.
 */

const AIRLINES: [string, string][] = [
  ["Skyward Air", "SW"],
  ["Pacific Crest", "PC"],
  ["Atlas Airways", "AT"],
  ["Northstar Airlines", "NS"],
  ["Meridian Air", "MR"],
  ["Blue Heron", "BH"],
  ["Aurora Airways", "AU"],
];
const BUDGET: [string, string][] = [
  ["Lumo Air", "LU"],
  ["Hopper Jet", "HJ"],
];
const HUBS = ["DXB", "IST", "FRA", "AMS", "LHR", "SIN", "HKG", "ICN", "ORD", "ATL", "DFW", "LAX", "HND", "DEL", "BKK", "MEX", "GRU"];

interface Spec {
  stops: 0 | 1 | 2;
  depHour: [number, number];
  price: number;
  budget?: boolean;
  redEye?: boolean;
}
const SPECS: Spec[] = [
  { stops: 0, depHour: [7, 9], price: 1.12 },
  { stops: 0, depHour: [12, 14], price: 1.0 },
  { stops: 0, depHour: [17, 19], price: 1.06 },
  { stops: 0, depHour: [6, 6], price: 1.3 },
  { stops: 1, depHour: [8, 11], price: 0.8 },
  { stops: 1, depHour: [14, 16], price: 0.86 },
  { stops: 0, depHour: [22, 23], price: 0.9, redEye: true },
  { stops: 2, depHour: [5, 7], price: 0.68, budget: true },
];

type Place = Pick<Airport, "iata" | "city" | "tz"> & { lat?: number; lng?: number };

export function resolvePlace(q: string): Place {
  const a = findAirport(q);
  if (a) return a;
  const letters = q.replace(/[^A-Za-z]/g, "").toUpperCase();
  return { iata: (letters + "XXX").slice(0, 3), city: q.split(",")[0].trim() || q, tz: "UTC" };
}

function distanceKm(a: Place, b: Place, fallback: number): number {
  return a.lat !== undefined && b.lat !== undefined && a.lng !== undefined && b.lng !== undefined
    ? haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
    : fallback;
}

function pickHub(o: Place, d: Place, avoid: string[], fallbackIndex: number): Airport {
  const hubs = HUBS.map((c) => airportByCode(c)!).filter((h) => h && !avoid.includes(h.iata) && h.iata !== o.iata && h.iata !== d.iata);
  if (o.lat === undefined || d.lat === undefined) return hubs[fallbackIndex % hubs.length];
  const direct = distanceKm(o, d, 0);
  return hubs.reduce((best, h) => {
    const detour = (x: Airport) => distanceKm(o, x, 0) + distanceKm(x, d, 0) - direct;
    return detour(h) < detour(best) ? h : best;
  });
}

function buildLeg(
  from: Place,
  to: Place,
  date: string,
  spec: Spec,
  airline: [string, string],
  baseMinutes: number,
  r: ReturnType<typeof seeded>,
  avoidHubs: string[],
  index: number,
): FlightLeg {
  const stops = spec.stops;
  const via: string[] = [];
  let extra = 0;
  for (let s = 0; s < stops; s++) {
    const hub = pickHub(from, to, [...avoidHubs, ...via], index + s);
    via.push(hub.iata);
    extra += r.int(70, 190) + 40;
  }
  const duration = Math.max(45, baseMinutes + extra + r.int(-15, 25));
  const hour = r.int(spec.depHour[0], spec.depHour[1]);
  const minute = r.pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  const depart = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const arrive = convertLocal(addMinutes(depart, duration), from.tz, to.tz);
  return {
    airline: airline[0],
    flightNumber: `${airline[1]} ${r.int(100, 2999)}`,
    from: from.iata,
    to: to.iata,
    depart,
    arrive,
    durationMinutes: duration,
    stops,
    via: via.length ? via.join(", ") : undefined,
  };
}

export function searchFlights(q: FlightQuery): FlightOption[] {
  const origin = resolvePlace(q.origin);
  const dest = resolvePlace(q.destination);
  const key = { o: origin.iata, d: dest.iata, dd: q.departDate, rd: q.returnDate ?? null, p: q.passengers, c: q.cabin ?? "economy" };
  const r = seeded(key);
  const km = distanceKm(origin, dest, r.int(1500, 9000));
  const nonstopPossible = km < 13500;
  const baseMinutes = Math.round((km / 820) * 60 + 35);
  const perPerson = (60 + km * 0.085) * (q.returnDate ? 1.85 : 1) * ({ economy: 1, premium: 1.7, business: 3.2 }[q.cabin ?? "economy"]);
  const carriers = r.shuffle(AIRLINES);

  const options: FlightOption[] = SPECS.map((spec0, i) => {
    const spec: Spec = !nonstopPossible && spec0.stops === 0 ? { ...spec0, stops: 1 } : spec0;
    const airline = spec.budget ? r.pick(BUDGET) : carriers[i % carriers.length];
    const outbound = buildLeg(origin, dest, q.departDate, spec, airline, baseMinutes, r, [], i);
    const inbound = q.returnDate
      ? buildLeg(dest, origin, q.returnDate, { ...spec, depHour: [(spec.depHour[0] + 3) % 24, (spec.depHour[1] + 3) % 24].sort((a, b) => a - b) as [number, number] }, airline, baseMinutes, r, [], i + 3)
      : undefined;
    const price = Math.round(perPerson * spec.price * (0.92 + r.next() * 0.16) * q.passengers);
    return {
      id: `FL-${hashString(JSON.stringify(key) + i).toString(36).slice(0, 6).toUpperCase()}`,
      airline: airline[0],
      cabin: q.cabin ?? "economy",
      price,
      currency: "USD",
      outbound,
      inbound,
      baggage: spec.budget ? "Carry-on only · checked bag extra" : "1 checked bag included",
      originTz: origin.tz,
      destinationTz: dest.tz,
      tags: [] as string[],
    };
  });

  const cheapest = Math.min(...options.map((o) => o.price));
  const fastest = Math.min(...options.map((o) => o.outbound.durationMinutes));
  for (const o of options) {
    if (o.price === cheapest) o.tags.push("Cheapest");
    if (o.outbound.durationMinutes === fastest) o.tags.push("Fastest");
    o.tags.push(o.outbound.stops === 0 ? "Nonstop" : `${o.outbound.stops} stop${o.outbound.stops > 1 ? "s" : ""}`);
    const h = Number(o.outbound.depart.slice(11, 13));
    if (h >= 21 || h < 4) o.tags.push("Red-eye");
  }
  return options.sort((a, b) => a.price - b.price);
}

export const mockFlightProvider: FlightProvider = {
  name: "mock",
  async search(q) {
    return searchFlights(q);
  },
  async book(option, passengers) {
    return { confirmationCode: confirmationCode(`${option.id}:${passengers}:${Date.now()}`), provider: "mock" };
  },
};

