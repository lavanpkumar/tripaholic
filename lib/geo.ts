// Small built-in gazetteer. Used for: place search when the geocoder is unreachable (and for states,
// which the geocoder does not index), airports for the mock flight provider, and multi-city routes
// for the offline planner. Not exhaustive by design.

export interface Airport {
  iata: string;
  city: string;
  country: string;
  tz: string;
  lat: number;
  lng: number;
}

const A = (iata: string, city: string, country: string, tz: string, lat: number, lng: number): Airport => ({
  iata, city, country, tz, lat, lng,
});

export const AIRPORTS: Airport[] = [
  A("JFK", "New York", "United States", "America/New_York", 40.64, -73.78),
  A("BOS", "Boston", "United States", "America/New_York", 42.36, -71.01),
  A("IAD", "Washington", "United States", "America/New_York", 38.95, -77.46),
  A("ATL", "Atlanta", "United States", "America/New_York", 33.64, -84.43),
  A("MIA", "Miami", "United States", "America/New_York", 25.79, -80.29),
  A("MCO", "Orlando", "United States", "America/New_York", 28.43, -81.31),
  A("ORD", "Chicago", "United States", "America/Chicago", 41.97, -87.91),
  A("DFW", "Dallas", "United States", "America/Chicago", 32.9, -97.04),
  A("AUS", "Austin", "United States", "America/Chicago", 30.19, -97.67),
  A("MSY", "New Orleans", "United States", "America/Chicago", 29.99, -90.26),
  A("BNA", "Nashville", "United States", "America/Chicago", 36.12, -86.68),
  A("DEN", "Denver", "United States", "America/Denver", 39.86, -104.67),
  A("SLC", "Salt Lake City", "United States", "America/Denver", 40.79, -111.98),
  A("PHX", "Phoenix", "United States", "America/Phoenix", 33.43, -112.01),
  A("LAS", "Las Vegas", "United States", "America/Los_Angeles", 36.08, -115.15),
  A("LAX", "Los Angeles", "United States", "America/Los_Angeles", 33.94, -118.41),
  A("SAN", "San Diego", "United States", "America/Los_Angeles", 32.73, -117.19),
  A("SFO", "San Francisco", "United States", "America/Los_Angeles", 37.62, -122.38),
  A("SEA", "Seattle", "United States", "America/Los_Angeles", 47.45, -122.31),
  A("PDX", "Portland", "United States", "America/Los_Angeles", 45.59, -122.6),
  A("ANC", "Anchorage", "United States", "America/Anchorage", 61.17, -150.0),
  A("HNL", "Honolulu", "United States", "Pacific/Honolulu", 21.32, -157.92),
  A("OGG", "Maui", "United States", "Pacific/Honolulu", 20.9, -156.43),
  A("SJU", "San Juan", "Puerto Rico", "America/Puerto_Rico", 18.44, -66.0),
  A("YYZ", "Toronto", "Canada", "America/Toronto", 43.68, -79.63),
  A("YUL", "Montreal", "Canada", "America/Toronto", 45.47, -73.74),
  A("YVR", "Vancouver", "Canada", "America/Vancouver", 49.19, -123.18),
  A("MEX", "Mexico City", "Mexico", "America/Mexico_City", 19.44, -99.07),
  A("CUN", "Cancún", "Mexico", "America/Cancun", 21.04, -86.87),
  A("SJO", "San José", "Costa Rica", "America/Costa_Rica", 9.99, -84.2),
  A("BOG", "Bogotá", "Colombia", "America/Bogota", 4.7, -74.15),
  A("CTG", "Cartagena", "Colombia", "America/Bogota", 10.44, -75.51),
  A("LIM", "Lima", "Peru", "America/Lima", -12.02, -77.11),
  A("CUZ", "Cusco", "Peru", "America/Lima", -13.54, -71.94),
  A("SCL", "Santiago", "Chile", "America/Santiago", -33.39, -70.79),
  A("EZE", "Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires", -34.82, -58.54),
  A("GRU", "São Paulo", "Brazil", "America/Sao_Paulo", -23.43, -46.47),
  A("GIG", "Rio de Janeiro", "Brazil", "America/Sao_Paulo", -22.81, -43.25),
  A("KEF", "Reykjavík", "Iceland", "Atlantic/Reykjavik", 63.99, -22.62),
  A("DUB", "Dublin", "Ireland", "Europe/Dublin", 53.43, -6.25),
  A("LHR", "London", "United Kingdom", "Europe/London", 51.47, -0.45),
  A("EDI", "Edinburgh", "United Kingdom", "Europe/London", 55.95, -3.37),
  A("CDG", "Paris", "France", "Europe/Paris", 49.01, 2.55),
  A("NCE", "Nice", "France", "Europe/Paris", 43.66, 7.21),
  A("LYS", "Lyon", "France", "Europe/Paris", 45.73, 5.08),
  A("AMS", "Amsterdam", "Netherlands", "Europe/Amsterdam", 52.31, 4.76),
  A("FRA", "Frankfurt", "Germany", "Europe/Berlin", 50.04, 8.56),
  A("MUC", "Munich", "Germany", "Europe/Berlin", 48.35, 11.79),
  A("BER", "Berlin", "Germany", "Europe/Berlin", 52.36, 13.5),
  A("ZRH", "Zurich", "Switzerland", "Europe/Zurich", 47.46, 8.55),
  A("VIE", "Vienna", "Austria", "Europe/Vienna", 48.11, 16.57),
  A("PRG", "Prague", "Czechia", "Europe/Prague", 50.1, 14.26),
  A("CPH", "Copenhagen", "Denmark", "Europe/Copenhagen", 55.62, 12.66),
  A("ARN", "Stockholm", "Sweden", "Europe/Stockholm", 59.65, 17.92),
  A("FCO", "Rome", "Italy", "Europe/Rome", 41.8, 12.25),
  A("MXP", "Milan", "Italy", "Europe/Rome", 45.63, 8.72),
  A("VCE", "Venice", "Italy", "Europe/Rome", 45.51, 12.35),
  A("FLR", "Florence", "Italy", "Europe/Rome", 43.81, 11.2),
  A("NAP", "Naples", "Italy", "Europe/Rome", 40.89, 14.29),
  A("MAD", "Madrid", "Spain", "Europe/Madrid", 40.49, -3.57),
  A("BCN", "Barcelona", "Spain", "Europe/Madrid", 41.3, 2.08),
  A("SVQ", "Seville", "Spain", "Europe/Madrid", 37.42, -5.89),
  A("LIS", "Lisbon", "Portugal", "Europe/Lisbon", 38.77, -9.13),
  A("OPO", "Porto", "Portugal", "Europe/Lisbon", 41.24, -8.68),
  A("DBV", "Dubrovnik", "Croatia", "Europe/Zagreb", 42.56, 18.27),
  A("ATH", "Athens", "Greece", "Europe/Athens", 37.94, 23.94),
  A("JTR", "Santorini", "Greece", "Europe/Athens", 36.4, 25.48),
  A("IST", "Istanbul", "Türkiye", "Europe/Istanbul", 41.26, 28.74),
  A("CAI", "Cairo", "Egypt", "Africa/Cairo", 30.12, 31.41),
  A("RAK", "Marrakech", "Morocco", "Africa/Casablanca", 31.61, -8.04),
  A("NBO", "Nairobi", "Kenya", "Africa/Nairobi", -1.32, 36.93),
  A("CPT", "Cape Town", "South Africa", "Africa/Johannesburg", -33.97, 18.6),
  A("DXB", "Dubai", "United Arab Emirates", "Asia/Dubai", 25.25, 55.36),
  A("DEL", "Delhi", "India", "Asia/Kolkata", 28.56, 77.1),
  A("BOM", "Mumbai", "India", "Asia/Kolkata", 19.09, 72.87),
  A("JAI", "Jaipur", "India", "Asia/Kolkata", 26.82, 75.81),
  A("GOI", "Goa", "India", "Asia/Kolkata", 15.38, 73.83),
  A("COK", "Kochi", "India", "Asia/Kolkata", 10.15, 76.4),
  A("CMB", "Colombo", "Sri Lanka", "Asia/Colombo", 7.18, 79.88),
  A("BKK", "Bangkok", "Thailand", "Asia/Bangkok", 13.69, 100.75),
  A("CNX", "Chiang Mai", "Thailand", "Asia/Bangkok", 18.77, 98.96),
  A("HKT", "Phuket", "Thailand", "Asia/Bangkok", 8.11, 98.31),
  A("HAN", "Hanoi", "Vietnam", "Asia/Ho_Chi_Minh", 21.22, 105.81),
  A("SGN", "Ho Chi Minh City", "Vietnam", "Asia/Ho_Chi_Minh", 10.82, 106.65),
  A("SIN", "Singapore", "Singapore", "Asia/Singapore", 1.36, 103.99),
  A("KUL", "Kuala Lumpur", "Malaysia", "Asia/Kuala_Lumpur", 2.75, 101.71),
  A("LGK", "Langkawi", "Malaysia", "Asia/Kuala_Lumpur", 6.33, 99.73),
  A("CGK", "Jakarta", "Indonesia", "Asia/Jakarta", -6.13, 106.66),
  A("DPS", "Bali (Denpasar)", "Indonesia", "Asia/Makassar", -8.75, 115.17),
  A("MNL", "Manila", "Philippines", "Asia/Manila", 14.51, 121.02),
  A("PPS", "Puerto Princesa", "Philippines", "Asia/Manila", 9.74, 118.76),
  A("HKG", "Hong Kong", "Hong Kong", "Asia/Hong_Kong", 22.31, 113.91),
  A("TPE", "Taipei", "Taiwan", "Asia/Taipei", 25.08, 121.23),
  A("PEK", "Beijing", "China", "Asia/Shanghai", 40.08, 116.58),
  A("PVG", "Shanghai", "China", "Asia/Shanghai", 31.14, 121.81),
  A("ICN", "Seoul", "South Korea", "Asia/Seoul", 37.46, 126.44),
  A("PUS", "Busan", "South Korea", "Asia/Seoul", 35.18, 128.94),
  A("HND", "Tokyo", "Japan", "Asia/Tokyo", 35.55, 139.78),
  A("KIX", "Osaka", "Japan", "Asia/Tokyo", 34.43, 135.24),
  A("HIJ", "Hiroshima", "Japan", "Asia/Tokyo", 34.44, 132.92),
  A("FUK", "Fukuoka", "Japan", "Asia/Tokyo", 33.59, 130.45),
  A("CTS", "Sapporo", "Japan", "Asia/Tokyo", 42.78, 141.69),
  A("OKA", "Okinawa", "Japan", "Asia/Tokyo", 26.2, 127.65),
  A("SYD", "Sydney", "Australia", "Australia/Sydney", -33.94, 151.18),
  A("MEL", "Melbourne", "Australia", "Australia/Melbourne", -37.67, 144.84),
  A("BNE", "Brisbane", "Australia", "Australia/Brisbane", -27.38, 153.12),
  A("CNS", "Cairns", "Australia", "Australia/Brisbane", -16.88, 145.75),
  A("AKL", "Auckland", "New Zealand", "Pacific/Auckland", -37.01, 174.79),
  A("ZQN", "Queenstown", "New Zealand", "Pacific/Auckland", -45.02, 168.74),
];

const AIRPORT_BY_CODE = new Map(AIRPORTS.map((a) => [a.iata, a]));

export function airportByCode(code: string): Airport | undefined {
  return AIRPORT_BY_CODE.get(code.trim().toUpperCase());
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Resolve "JFK", "New York", "new york city", "Tokyo, Japan" to an airport, if we know one. */
export function findAirport(query: string): Airport | undefined {
  const q = query.trim();
  if (/^[A-Za-z]{3}$/.test(q)) {
    const byCode = airportByCode(q);
    if (byCode) return byCode;
  }
  const n = norm(q);
  const head = norm(q.split(",")[0]);
  return (
    AIRPORTS.find((a) => norm(a.city) === head) ??
    AIRPORTS.find((a) => n.startsWith(norm(a.city)) || head.startsWith(norm(a.city))) ??
    AIRPORTS.find((a) => norm(a.city).startsWith(head) && head.length >= 4)
  );
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestAirport(point: { lat: number; lng: number }, country?: string): Airport {
  const pool = country ? AIRPORTS.filter((a) => norm(a.country) === norm(country)) : [];
  const candidates = pool.length ? pool : AIRPORTS;
  return candidates.reduce((best, a) => (haversineKm(point, a) < haversineKm(point, best) ? a : best));
}

// ---------- regions (countries and states) ----------

export interface Region {
  name: string;
  kind: "country" | "state";
  country: string;
  tz: string;
  lat: number;
  lng: number;
  /** Cities/areas a multi-stop trip would typically visit, in a sensible travel order. */
  stops: string[];
}

const R = (name: string, kind: Region["kind"], country: string, tz: string, lat: number, lng: number, stops: string[]): Region => ({
  name, kind, country, tz, lat, lng, stops,
});

export const REGIONS: Region[] = [
  R("Japan", "country", "Japan", "Asia/Tokyo", 36.2, 138.25, ["Tokyo", "Hakone", "Kyoto", "Nara", "Osaka", "Hiroshima"]),
  R("Italy", "country", "Italy", "Europe/Rome", 41.87, 12.57, ["Rome", "Florence", "Cinque Terre", "Venice", "Milan"]),
  R("France", "country", "France", "Europe/Paris", 46.6, 1.89, ["Paris", "Loire Valley", "Lyon", "Avignon", "Nice"]),
  R("Spain", "country", "Spain", "Europe/Madrid", 40.46, -3.75, ["Barcelona", "Madrid", "Toledo", "Seville", "Granada"]),
  R("Portugal", "country", "Portugal", "Europe/Lisbon", 39.4, -8.22, ["Lisbon", "Sintra", "Porto", "Douro Valley", "Lagos"]),
  R("United Kingdom", "country", "United Kingdom", "Europe/London", 55.38, -3.44, ["London", "Oxford", "Bath", "York", "Edinburgh"]),
  R("Ireland", "country", "Ireland", "Europe/Dublin", 53.41, -8.24, ["Dublin", "Galway", "Cliffs of Moher", "Killarney", "Cork"]),
  R("Germany", "country", "Germany", "Europe/Berlin", 51.17, 10.45, ["Berlin", "Dresden", "Nuremberg", "Munich", "Neuschwanstein"]),
  R("Greece", "country", "Greece", "Europe/Athens", 39.07, 21.82, ["Athens", "Delphi", "Mykonos", "Naxos", "Santorini"]),
  R("Croatia", "country", "Croatia", "Europe/Zagreb", 45.1, 15.2, ["Zagreb", "Plitvice Lakes", "Split", "Hvar", "Dubrovnik"]),
  R("Iceland", "country", "Iceland", "Atlantic/Reykjavik", 64.96, -19.02, ["Reykjavík", "Golden Circle", "Vík", "Jökulsárlón", "Snæfellsnes"]),
  R("Türkiye", "country", "Türkiye", "Europe/Istanbul", 38.96, 35.24, ["Istanbul", "Cappadocia", "Pamukkale", "Ephesus", "Antalya"]),
  R("Morocco", "country", "Morocco", "Africa/Casablanca", 31.79, -7.09, ["Marrakech", "Atlas Mountains", "Fes", "Chefchaouen", "Essaouira"]),
  R("Egypt", "country", "Egypt", "Africa/Cairo", 26.82, 30.8, ["Cairo", "Giza", "Luxor", "Aswan"]),
  R("South Africa", "country", "South Africa", "Africa/Johannesburg", -30.56, 22.94, ["Cape Town", "Stellenbosch", "Hermanus", "Kruger National Park"]),
  R("India", "country", "India", "Asia/Kolkata", 20.59, 78.96, ["Delhi", "Agra", "Jaipur", "Udaipur", "Mumbai"]),
  R("Sri Lanka", "country", "Sri Lanka", "Asia/Colombo", 7.87, 80.77, ["Colombo", "Galle", "Mirissa", "Ella", "Kandy"]),
  R("Thailand", "country", "Thailand", "Asia/Bangkok", 15.87, 100.99, ["Bangkok", "Ayutthaya", "Chiang Mai", "Phuket", "Krabi"]),
  R("Vietnam", "country", "Vietnam", "Asia/Ho_Chi_Minh", 14.06, 108.28, ["Hanoi", "Ha Long Bay", "Hue", "Hoi An", "Ho Chi Minh City"]),
  R("Indonesia", "country", "Indonesia", "Asia/Makassar", -0.79, 113.92, ["Bali", "Nusa Penida", "Yogyakarta", "Jakarta"]),
  R("Philippines", "country", "Philippines", "Asia/Manila", 12.88, 121.77, ["Manila", "Palawan", "Cebu", "Bohol", "Boracay"]),
  R("Malaysia", "country", "Malaysia", "Asia/Kuala_Lumpur", 4.21, 101.98, ["Kuala Lumpur", "Malacca", "Penang", "Langkawi"]),
  R("South Korea", "country", "South Korea", "Asia/Seoul", 35.91, 127.77, ["Seoul", "Gyeongju", "Busan", "Jeju"]),
  R("China", "country", "China", "Asia/Shanghai", 35.86, 104.2, ["Beijing", "Xi'an", "Chengdu", "Guilin", "Shanghai"]),
  R("Australia", "country", "Australia", "Australia/Sydney", -25.27, 133.78, ["Sydney", "Blue Mountains", "Melbourne", "Great Ocean Road", "Cairns"]),
  R("New Zealand", "country", "New Zealand", "Pacific/Auckland", -40.9, 174.89, ["Auckland", "Rotorua", "Wellington", "Queenstown", "Milford Sound"]),
  R("Canada", "country", "Canada", "America/Toronto", 56.13, -106.35, ["Toronto", "Niagara Falls", "Montreal", "Quebec City", "Vancouver"]),
  R("United States", "country", "United States", "America/New_York", 39.83, -98.58, ["New York", "Washington", "Chicago", "San Francisco", "Los Angeles"]),
  R("Mexico", "country", "Mexico", "America/Mexico_City", 23.63, -102.55, ["Mexico City", "Puebla", "Oaxaca", "Mérida", "Tulum"]),
  R("Costa Rica", "country", "Costa Rica", "America/Costa_Rica", 9.75, -83.75, ["San José", "Arenal", "Monteverde", "Manuel Antonio"]),
  R("Peru", "country", "Peru", "America/Lima", -9.19, -75.02, ["Lima", "Cusco", "Sacred Valley", "Machu Picchu", "Arequipa"]),
  R("Colombia", "country", "Colombia", "America/Bogota", 4.57, -74.3, ["Bogotá", "Medellín", "Coffee Region", "Cartagena"]),
  R("Argentina", "country", "Argentina", "America/Argentina/Buenos_Aires", -38.42, -63.62, ["Buenos Aires", "Mendoza", "Bariloche", "Iguazú Falls"]),
  R("Brazil", "country", "Brazil", "America/Sao_Paulo", -14.24, -51.93, ["Rio de Janeiro", "Paraty", "São Paulo", "Iguaçu Falls"]),

  R("California", "state", "United States", "America/Los_Angeles", 36.78, -119.42, ["San Francisco", "Napa Valley", "Monterey", "Big Sur", "Los Angeles", "San Diego"]),
  R("New York", "state", "United States", "America/New_York", 42.17, -74.95, ["New York City", "Hudson Valley", "Finger Lakes", "Niagara Falls"]),
  R("Florida", "state", "United States", "America/New_York", 27.66, -81.52, ["Miami", "Everglades", "Key West", "Orlando", "St. Augustine"]),
  R("Hawaii", "state", "United States", "Pacific/Honolulu", 19.9, -155.58, ["Honolulu", "North Shore", "Maui", "Big Island"]),
  R("Texas", "state", "United States", "America/Chicago", 31.97, -99.9, ["Austin", "San Antonio", "Houston", "Dallas"]),
  R("Colorado", "state", "United States", "America/Denver", 39.55, -105.78, ["Denver", "Boulder", "Rocky Mountain National Park", "Aspen"]),
  R("Washington", "state", "United States", "America/Los_Angeles", 47.75, -120.74, ["Seattle", "Olympic Peninsula", "Mount Rainier", "San Juan Islands"]),
  R("Arizona", "state", "United States", "America/Phoenix", 34.05, -111.09, ["Phoenix", "Sedona", "Grand Canyon", "Page"]),
  R("Utah", "state", "United States", "America/Denver", 39.32, -111.09, ["Salt Lake City", "Moab", "Bryce Canyon", "Zion National Park"]),
  R("Louisiana", "state", "United States", "America/Chicago", 30.98, -91.96, ["New Orleans", "Baton Rouge", "Lafayette"]),
  R("Tennessee", "state", "United States", "America/Chicago", 35.52, -86.58, ["Nashville", "Chattanooga", "Great Smoky Mountains", "Memphis"]),
  R("Massachusetts", "state", "United States", "America/New_York", 42.41, -71.38, ["Boston", "Salem", "Cape Cod", "Martha's Vineyard"]),
  R("Alaska", "state", "United States", "America/Anchorage", 64.2, -149.49, ["Anchorage", "Seward", "Denali", "Talkeetna"]),
  R("Oregon", "state", "United States", "America/Los_Angeles", 43.8, -120.55, ["Portland", "Columbia River Gorge", "Bend", "Cannon Beach"]),
  R("Bali", "state", "Indonesia", "Asia/Makassar", -8.34, 115.09, ["Ubud", "Sidemen", "Sanur", "Uluwatu", "Seminyak"]),
  R("Palawan", "state", "Philippines", "Asia/Manila", 9.83, 118.74, ["Puerto Princesa", "Port Barton", "El Nido", "Coron"]),
  R("Hokkaido", "state", "Japan", "Asia/Tokyo", 43.22, 142.86, ["Sapporo", "Otaru", "Furano", "Niseko"]),
  R("Okinawa", "state", "Japan", "Asia/Tokyo", 26.21, 127.68, ["Naha", "Motobu Peninsula", "Kerama Islands"]),
  R("Tuscany", "state", "Italy", "Europe/Rome", 43.77, 11.25, ["Florence", "Siena", "Val d'Orcia", "Lucca", "Pisa"]),
  R("Bavaria", "state", "Germany", "Europe/Berlin", 48.79, 11.5, ["Munich", "Neuschwanstein", "Garmisch-Partenkirchen", "Nuremberg"]),
  R("Andalusia", "state", "Spain", "Europe/Madrid", 37.54, -4.73, ["Seville", "Córdoba", "Granada", "Ronda", "Málaga"]),
  R("Catalonia", "state", "Spain", "Europe/Madrid", 41.59, 1.52, ["Barcelona", "Montserrat", "Girona", "Costa Brava"]),
  R("Scotland", "state", "United Kingdom", "Europe/London", 56.49, -4.2, ["Edinburgh", "Glasgow", "Glencoe", "Isle of Skye", "Inverness"]),
  R("Ontario", "state", "Canada", "America/Toronto", 51.25, -85.32, ["Toronto", "Niagara Falls", "Ottawa", "Muskoka"]),
  R("Quebec", "state", "Canada", "America/Toronto", 52.94, -73.55, ["Montreal", "Quebec City", "Mont-Tremblant"]),
  R("British Columbia", "state", "Canada", "America/Vancouver", 53.73, -127.65, ["Vancouver", "Whistler", "Victoria", "Tofino"]),
  R("Queensland", "state", "Australia", "Australia/Brisbane", -20.92, 142.7, ["Brisbane", "Gold Coast", "Cairns", "Whitsunday Islands"]),
  R("New South Wales", "state", "Australia", "Australia/Sydney", -31.84, 145.61, ["Sydney", "Blue Mountains", "Hunter Valley", "Byron Bay"]),
  R("Kerala", "state", "India", "Asia/Kolkata", 10.85, 76.27, ["Kochi", "Munnar", "Alleppey", "Varkala"]),
  R("Rajasthan", "state", "India", "Asia/Kolkata", 27.02, 74.22, ["Jaipur", "Jodhpur", "Udaipur", "Jaisalmer"]),
  R("Goa", "state", "India", "Asia/Kolkata", 15.3, 74.12, ["Panaji", "Old Goa", "Anjuna", "Palolem"]),
  R("Yucatán", "state", "Mexico", "America/Merida", 20.71, -89.09, ["Mérida", "Chichén Itzá", "Valladolid", "Izamal"]),
];

/** US states not covered above, so typing any state still resolves with a sensible time zone. */
const OTHER_US_STATES: [string, string][] = [
  ["Alabama", "America/Chicago"], ["Arkansas", "America/Chicago"], ["Connecticut", "America/New_York"],
  ["Delaware", "America/New_York"], ["Georgia", "America/New_York"], ["Idaho", "America/Boise"],
  ["Illinois", "America/Chicago"], ["Indiana", "America/Indiana/Indianapolis"], ["Iowa", "America/Chicago"],
  ["Kansas", "America/Chicago"], ["Kentucky", "America/New_York"], ["Maine", "America/New_York"],
  ["Maryland", "America/New_York"], ["Michigan", "America/Detroit"], ["Minnesota", "America/Chicago"],
  ["Mississippi", "America/Chicago"], ["Missouri", "America/Chicago"], ["Montana", "America/Denver"],
  ["Nebraska", "America/Chicago"], ["Nevada", "America/Los_Angeles"], ["New Hampshire", "America/New_York"],
  ["New Jersey", "America/New_York"], ["New Mexico", "America/Denver"], ["North Carolina", "America/New_York"],
  ["North Dakota", "America/Chicago"], ["Ohio", "America/New_York"], ["Oklahoma", "America/Chicago"],
  ["Pennsylvania", "America/New_York"], ["Rhode Island", "America/New_York"], ["South Carolina", "America/New_York"],
  ["South Dakota", "America/Chicago"], ["Vermont", "America/New_York"], ["Virginia", "America/New_York"],
  ["West Virginia", "America/New_York"], ["Wisconsin", "America/Chicago"], ["Wyoming", "America/Denver"],
];
export const US_STATE_ZONES = new Map(OTHER_US_STATES.map(([n, tz]) => [n, tz]));

export function findRegion(name: string): Region | undefined {
  const head = norm(name.split(",")[0]);
  return REGIONS.find((r) => norm(r.name) === head);
}

export function searchRegions(query: string): Region[] {
  const q = norm(query);
  if (!q) return [];
  return REGIONS.filter((r) => norm(r.name).startsWith(q) || norm(`${r.name} ${r.country}`).startsWith(q));
}
