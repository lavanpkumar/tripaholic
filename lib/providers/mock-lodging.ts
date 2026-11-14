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

export function searchLodging(q: LodgingQuery): LodgingOption[] {
  const place = q.location.split(",")[0].trim() || q.location;
  const nights = Math.max(1, diffDays(q.checkIn, q.checkOut));
  const key = { l: place.toLowerCase(), ci: q.checkIn, co: q.checkOut, g: q.guests, t: q.type ?? null, b: q.budget ?? null };
  const r = seeded(key);
  const base = r.int(85, 210);
  const homes = q.type === "airbnb" ? 6 : q.type === "hotel" ? 2 : 3;
  const words = r.shuffle(WORDS);
  const hoods = r.shuffle(NEIGHBORHOODS);

  const options: LodgingOption[] = Array.from({ length: 8 }, (_, i) => {
    const isHome = i < homes;
    const nb = hoods[i % hoods.length];
    const w = words[i % words.length];
    const name = isHome ? r.pick(HOME_NAMES)(nb) : r.pick(HOTEL_NAMES)(w, nb);
    let nightly = Math.round(base * (0.45 + r.next() * 1.4) * (q.guests > 2 ? 1 + (q.guests - 2) * 0.18 : 1));
    // Make sure a budget always has a few real choices under it.
    if (q.budget && i % 3 === 0) nightly = Math.min(nightly, Math.round(q.budget * (0.7 + r.next() * 0.28)));
    const amenities = r
      .shuffle(AMENITIES)
      .slice(0, r.int(3, 5))
      .concat(isHome ? ["Kitchen", "Washer"] : []);
    return {
      id: `ST-${hashString(JSON.stringify(key) + i).toString(36).slice(0, 6).toUpperCase()}`,
      name,
      type: isHome ? "airbnb" : "hotel",
      neighborhood: `${nb}, ${place}`,
      address: `${r.int(2, 240)} ${w} Street, ${nb}, ${place}`,
      rating: Math.round((4 + r.next() * 0.95) * 10) / 10,
      reviews: r.int(38, 940),
      nightlyPrice: nightly,
      totalPrice: nightly * nights,
      nights,
      currency: "USD",
      amenities: [...new Set(amenities)],
      distanceKm: Math.round((0.3 + r.next() * 6) * 10) / 10,
      cancellation: r.next() < 0.65 ? "Free cancellation until 48 hours before check-in" : "Non-refundable",
      photo: PHOTOS[i % PHOTOS.length],
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
