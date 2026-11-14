import { diffDays } from "../dates";
import { confirmationCode, hashString, seeded } from "./random";
import type { LodgingOption, LodgingProvider, LodgingQuery } from "./types";

/**
 * Deterministic mock lodging search: 8 stays (hotels and Airbnb-style homes) with varied price,
 * rating, location, and amenities. Names are generated; the UI labels everything as demo data.
 */

const NEIGHBORHOODS = ["Old Town", "City Center", "Riverside", "Arts District", "Harbor", "Garden Quarter", "Market Quarter", "Hillside"];
const WORDS = ["Linden", "Saffron", "Juniper", "Lantern", "Cedar", "Willow", "Marigold", "Indigo", "Banyan", "Palm Grove"];
const HOTEL_NAMES = [
  (w: string, n: string) => `${w} House ${n}`,
  (w: string) => `Hotel ${w}`,
  (w: string, n: string) => `The ${n} ${w}`,
  (w: string) => `${w} & Co. Boutique Hotel`,
  (w: string) => `${w} Garden Hotel`,
  (w: string, n: string) => `${n} Grand by ${w}`,
];
const HOME_NAMES = [
  (n: string) => `Sunny loft in ${n}`,
  (n: string) => `Entire apartment, ${n}`,
  (n: string) => `Garden studio near ${n}`,
  () => "Private villa with plunge pool",
  () => "Quiet flat with a balcony",
];
const AMENITIES = ["Free Wi-Fi", "Breakfast included", "Pool", "Air conditioning", "Gym", "Spa", "Airport shuttle", "Rooftop bar", "Workspace", "Parking"];
const PHOTOS = ["/assets/palm-grove.png", "/assets/sora-villa.png", "/assets/banyan.png"];

/** A property's identity: stable for a place, whatever the dates, guests, or filters. */
interface Property {
  key: string;
  name: string;
  type: "hotel" | "airbnb";
  nb: string;
  address: string;
  rating: number;
  reviews: number;
  amenities: string[];
  distanceKm: number;
  cancellation: string;
  photo: string;
  /** Relative price level, multiplied by the query's base rate. */
  priceLevel: number;
}

/** The same 6 hotels and 6 homes every time a place is searched. */
function propertiesFor(place: string): { hotels: Property[]; homes: Property[] } {
  const p = seeded({ place: place.toLowerCase() });
  const words = p.shuffle(WORDS);
  const hoods = p.shuffle(NEIGHBORHOODS);
  const make = (i: number, isHome: boolean): Property => {
    const nb = hoods[i % hoods.length];
    const w = words[i % words.length];
    const name = isHome ? HOME_NAMES[i % HOME_NAMES.length](nb) : HOTEL_NAMES[i % HOTEL_NAMES.length](w, nb);
    return {
      key: `mock:${place.toLowerCase()}:${name.toLowerCase()}|${nb.toLowerCase()}`,
      name,
      type: isHome ? "airbnb" : "hotel",
      nb,
      address: `${p.int(2, 240)} ${w} Street, ${nb}, ${place}`,
      rating: Math.round((4 + p.next() * 0.95) * 10) / 10,
      reviews: p.int(38, 940),
      // Homes lead with what makes them homes, so cards (which show the first few) always list them.
      amenities: [...new Set((isHome ? ["Kitchen", "Washer"] : []).concat(p.shuffle(AMENITIES).slice(0, p.int(3, 5))))],
      distanceKm: Math.round((0.3 + p.next() * 6) * 10) / 10,
      cancellation: p.next() < 0.65 ? "Free cancellation until 48 hours before check-in" : "Non-refundable",
      photo: PHOTOS[i % PHOTOS.length],
      priceLevel: 0.45 + p.next() * 1.4,
    };
  };
  return {
    hotels: Array.from({ length: 6 }, (_, i) => make(i, false)),
    homes: Array.from({ length: 6 }, (_, i) => make(i + 6, true)),
  };
}

export function searchLodging(q: LodgingQuery): LodgingOption[] {
  const place = q.location.split(",")[0].trim() || q.location;
  const nights = Math.max(1, diffDays(q.checkIn, q.checkOut));
  const key = { l: place.toLowerCase(), ci: q.checkIn, co: q.checkOut, g: q.guests, t: q.type ?? null, b: q.budget ?? null };
  // Prices vary with dates and party size; the properties themselves do not.
  const r = seeded(key);
  const base = r.int(85, 210);
  const homeCount = q.type === "airbnb" ? 6 : q.type === "hotel" ? 2 : 3;
  const { hotels, homes } = propertiesFor(place);
  const picked = [...homes.slice(0, homeCount), ...hotels.slice(0, 8 - homeCount)];

  const options: LodgingOption[] = picked.map((prop, i) => {
    let nightly = Math.round(base * prop.priceLevel * (0.9 + r.next() * 0.2) * (q.guests > 2 ? 1 + (q.guests - 2) * 0.18 : 1));
    // Make sure a budget always has a few real choices under it.
    if (q.budget && i % 3 === 0) nightly = Math.min(nightly, Math.round(q.budget * (0.7 + r.next() * 0.28)));
    return {
      id: `ST-${hashString(JSON.stringify(key) + prop.key).toString(36).slice(0, 6).toUpperCase()}`,
      key: prop.key,
      name: prop.name,
      type: prop.type,
      neighborhood: `${prop.nb}, ${place}`,
      address: prop.address,
      rating: prop.rating,
      reviews: prop.reviews,
      nightlyPrice: nightly,
      totalPrice: nightly * nights,
      nights,
      currency: "USD",
      amenities: prop.amenities,
      distanceKm: prop.distanceKm,
      cancellation: prop.cancellation,
      photo: prop.photo,
      tags: [] as string[],
    };
  });

  const byPrice = Math.min(...options.map((o) => o.nightlyPrice));
  const byRating = Math.max(...options.map((o) => o.rating));
  const byDistance = Math.min(...options.map((o) => o.distanceKm));
  const value = options.reduce((b, o) => (o.rating / o.nightlyPrice > b.rating / b.nightlyPrice ? o : b));
  for (const o of options) {
    if (o.nightlyPrice === byPrice) o.tags.push("Lowest price");
    if (o.rating === byRating) o.tags.push("Top rated");
    if (o.distanceKm === byDistance) o.tags.push("Closest to center");
    if (o === value) o.tags.push("Best value");
    if (o.type === "airbnb") o.tags.push("Entire home");
  }
  return options.sort((a, b) => b.rating - a.rating || a.nightlyPrice - b.nightlyPrice);
}

export const mockLodgingProvider: LodgingProvider = {
  name: "mock",
  async search(q) {
    return searchLodging(q);
  },
  async book(option, stay) {
    return { confirmationCode: confirmationCode(`${option.id}:${stay.checkIn}:${Date.now()}`), provider: "mock" };
  },
};
