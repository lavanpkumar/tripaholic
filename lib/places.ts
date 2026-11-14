import { AIRPORTS, US_STATE_ZONES, searchRegions } from "./geo";
import type { Scope } from "./types";

/** Place autocomplete: Open-Meteo geocoding (free, keyless, returns time zones) + the built-in gazetteer. */

export interface Place {
  id: string;
  /** Short name, e.g. "Tokyo" */
  name: string;
  /** Display label, e.g. "Tokyo, Japan" */
  label: string;
  kind: "city" | "state" | "country" | "place";
  timezone: string;
  lat?: number;
  lng?: number;
  country?: string;
  region?: string;
}

export function suggestedScope(kind: Place["kind"]): Scope | undefined {
  return kind === "city" || kind === "state" || kind === "country" ? kind : undefined;
}

interface OpenMeteoResult {
  id: number;
  name: string;
  feature_code?: string;
  country?: string;
  admin1?: string;
  timezone?: string;
  latitude: number;
  longitude: number;
}

function kindFromFeature(code = ""): Place["kind"] {
  if (code.startsWith("PCL")) return "country";
  if (code === "ADM1") return "state";
  if (code.startsWith("PPL")) return "city";
  return "place";
}

function labelOf(parts: (string | undefined)[]): string {
  const out: string[] = [];
  for (const p of parts) if (p && !out.includes(p)) out.push(p);
  return out.join(", ");
}

async function geocode(q: string): Promise<Place[] | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500), cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: OpenMeteoResult[] };
    return (body.results ?? [])
      .filter((r) => r.timezone)
      .map((r) => {
        const kind = kindFromFeature(r.feature_code);
        return {
          id: `om-${r.id}`,
          name: r.name,
          label: kind === "country" ? r.name : labelOf([r.name, kind === "state" ? undefined : r.admin1, r.country]),
          kind,
          timezone: r.timezone!,
          lat: r.latitude,
          lng: r.longitude,
          country: r.country,
          region: r.admin1,
        };
      });
  } catch {
    return null;
  }
}

function builtin(q: string, includeCities: boolean): Place[] {
  const lower = q.toLowerCase();
  const regions: Place[] = searchRegions(q).map((r) => ({
    id: `geo-${r.kind}-${r.name}`,
    name: r.name,
    label: r.kind === "country" ? r.name : `${r.name}, ${r.country}`,
    kind: r.kind,
    timezone: r.tz,
    lat: r.lat,
    lng: r.lng,
    country: r.country,
  }));
  const states: Place[] = [...US_STATE_ZONES]
    .filter(([name]) => name.toLowerCase().startsWith(lower))
    .map(([name, tz]) => ({
      id: `geo-us-${name}`,
      name,
      label: `${name}, United States`,
      kind: "state" as const,
      timezone: tz,
      country: "United States",
    }));
  const cities: Place[] = includeCities
    ? AIRPORTS.filter((a) => a.city.toLowerCase().startsWith(lower)).map((a) => ({
        id: `geo-city-${a.iata}`,
        name: a.city,
        label: `${a.city}, ${a.country}`,
        kind: "city" as const,
        timezone: a.tz,
        lat: a.lat,
        lng: a.lng,
        country: a.country,
      }))
    : [];
  return [...regions, ...states, ...cities];
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const remote = await geocode(q);
  // Built-in regions first (the geocoder does not index states), then geocoder results.
  // Built-in cities are only used when the geocoder is unreachable.
  const merged = [...builtin(q, remote === null), ...(remote ?? [])];
  const seen = new Set<string>();
  return merged
    .filter((p) => {
      const key = p.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
