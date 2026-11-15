import { addDays, at, eachDay, hhmm } from "../dates";
import { findRegion } from "../geo";
import type { DerivedConstraints, PlannerContext } from "./context";
import type { PlannedEvent } from "./postprocess";

/**
 * Deterministic planner used when Gemini is not configured or fails. It cannot name real venues,
 * so it plans the shape of good days (sights in the morning, meals at mealtimes, multi-city
 * routing for state/country trips) with honest, general titles.
 */

export interface DraftPlan {
  summary: string;
  highlights: { title: string; body: string }[];
  events: PlannedEvent[];
}

type Maker = (place: string) => { title: string; description: string; reason: string };

const SIGHTS: Maker[] = [
  (p) => ({ title: `Historic center walk, ${p}`, description: `Wander the oldest streets and main square of ${p}.`, reason: "Mornings are cooler and quieter, the best time for the headline sights before crowds build." }),
  (p) => ({ title: `${p}'s main museum`, description: "Start with the highlights gallery, then pick one wing to explore properly.", reason: "A museum anchors the day with context for everything else you will see." }),
  (p) => ({ title: `Landmark viewpoint over ${p}`, description: "Get the lay of the land from the best-known lookout.", reason: "Seeing the city from above early makes the rest of the trip easier to navigate." }),
  (p) => ({ title: `Temples, churches & old architecture in ${p}`, description: "A loop of the most photographed historic buildings.", reason: "Grouping nearby historic sites keeps walking short and the morning relaxed." }),
  (p) => ({ title: `Local market & old quarter, ${p}`, description: "Browse stalls, then explore the lanes around the market.", reason: "Markets are liveliest in the morning and show everyday local life." }),
];

const ACTIVITIES: Maker[] = [
  (p) => ({ title: `Parks & gardens in ${p}`, description: "A slow afternoon in the green heart of town.", reason: "An easy outdoor afternoon balances a busy morning of sightseeing." }),
  (p) => ({ title: `Neighborhood bike ride, ${p}`, description: "Rent a bike and cover more ground at an easy pace.", reason: "A bike covers more neighborhoods than walking without the rush of a tour." }),
  (p) => ({ title: `Waterfront walk, ${p}`, description: "Follow the river, harbor, or coast toward sunset.", reason: "Late afternoon light makes this the most pleasant time to be by the water." }),
  (p) => ({ title: `Cooking class in ${p}`, description: "Learn two or three regional dishes, then eat them.", reason: "A hands-on class is the most memorable way into the local food culture." }),
  (p) => ({ title: `Scenic hike near ${p}`, description: "A short trail to a lookout, with time to linger at the top.", reason: "Getting out of town for a few hours adds variety to a city-heavy trip." }),
  (p) => ({ title: `Spa or thermal baths, ${p}`, description: "Unwind before dinner.", reason: "Leaving room to rest keeps the pace enjoyable over several days." }),
];

const LUNCH: Maker[] = [
  (p) => ({ title: `Lunch at a local favorite, ${p}`, description: "Look for a busy spot full of locals.", reason: "A proper midday break, timed for lunch and close to the morning's sights." }),
  (p) => ({ title: `Street-food lunch, ${p}`, description: "Graze a few stalls instead of one sit-down meal.", reason: "Street food is quick, cheap, and the most direct taste of the region." }),
  (p) => ({ title: `Market hall lunch, ${p}`, description: "Pick from counters serving regional specialties.", reason: "Lunch near the morning's route saves a trip back across town." }),
];

const DINNER: Maker[] = [
  (p) => ({ title: `Dinner of regional specialties, ${p}`, description: "Ask for the dish the area is known for.", reason: "Dinner at a normal local hour, near where the afternoon ends." }),
  (p) => ({ title: `Sunset dinner, ${p}`, description: "Somewhere with a view as the light goes.", reason: "Timed for sunset so the day ends on a high note." }),
  (p) => ({ title: `Dinner in a lively food district, ${p}`, description: "A neighborhood with plenty of choice and evening atmosphere.", reason: "A busy food street gives options and a sense of the city at night." }),
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Which stop each trip day belongs to. Long-enough trips get 2+ nights per stop. */
export function routeStops(ctx: PlannerContext): { stops: string[]; byDay: string[] } {
  const { trip } = ctx;
  const days = eachDay(trip.startDate, trip.endDate);
  const short = trip.destination.name.split(",")[0].trim();
  const region = trip.destination.scope === "city" ? undefined : findRegion(trip.destination.name);
  const pool = trip.destination.scope === "city" ? [short] : region?.stops ?? [short];
  const count = Math.max(1, Math.min(pool.length, trip.destination.scope === "city" ? 1 : Math.round(days.length / 2)));
  const stops = pool.slice(0, count);
  const byDay = days.map((_, i) => stops[Math.min(stops.length - 1, Math.floor((i * stops.length) / days.length))]);
  return { stops, byDay };
}

const NIGHTLIFE = /\b(club(s|bing)?|nightclubs?|nightlife|night ?life|night out|bars?|bar-?hopping|pub crawl|part(y|ying|ies)|live music|dancing)\b/i;

/** The offline planner has no language model, so it reads the request for simple keywords. */
export function nightlifeRequest(preferences?: string): { description: string } | null {
  const m = preferences?.match(NIGHTLIFE);
  if (!m) return null;
  const word = m[1].toLowerCase();
  if (word.startsWith("live") || word === "dancing")
    return { description: "Live music and dancing, then a late bar. Check who's playing and the door times on the day." };
  if (word.startsWith("club") || word.startsWith("nightclub") || word.startsWith("part"))
    return { description: "Clubs and late bars in the liveliest district. Check the dress code and cover charge on the night." };
  return { description: "Bars and late-night spots in the liveliest part of town." };
}

export function offlinePlan(ctx: PlannerContext, c: DerivedConstraints): DraftPlan {
  const { trip } = ctx;
  const days = eachDay(trip.startDate, trip.endDate);
  const { stops, byDay } = routeStops(ctx);
  const seed = hash(trip.id);
  const pick = <T>(list: T[], i: number) => list[(seed + i) % list.length];
  const events: PlannedEvent[] = [];
  const add = (day: string, from: string, to: string, category: PlannedEvent["category"], m: ReturnType<Maker>, location: string) =>
    events.push({ ...m, start: at(day, from), end: at(day, to), category, location });

  const nightlife = nightlifeRequest(ctx.preferences);
  const departureDay = c.departure?.at.slice(0, 10);
  let nightsOut = 0;
  let lateLastNight = false;

  days.forEach((day, i) => {
    const place = byDay[i];
    const arrivingHere = i > 0 && byDay[i - 1] !== place;
    const morning = lateLastNight ? ["10:30", "12:00"] : ["09:30", "11:30"];
    if (arrivingHere) {
      add(day, "09:00", "11:30", "travel", {
        title: `Travel ${byDay[i - 1]} → ${place}`,
        description: "Train, bus, or drive between stops. Check schedules the day before.",
        reason: "Moving in the morning means you arrive with the whole afternoon free to explore.",
      }, place);
    } else {
      add(day, morning[0], morning[1], "sight", pick(SIGHTS, i)(place), place);
    }
    add(day, "12:30", "13:30", "food", pick(LUNCH, i)(place), place);
    add(day, "14:30", "16:30", "activity", pick(ACTIVITIES, i)(place), place);
    add(day, "19:00", "20:30", "food", pick(DINNER, i)(place), place);

    // Nightlife on most nights: not before an early travel morning or a departure day.
    const next = addDays(day, 1);
    const earlyStartTomorrow = (i + 1 < days.length && byDay[i + 1] !== place) || next === departureDay;
    lateLastNight = false;
    if (nightlife && !earlyStartTomorrow) {
      events.push({
        title: `Nightlife in ${place}`,
        description: nightlife.description,
        reason: "You asked for nights out, so this starts after dinner and runs late. The next morning starts later to make up for it.",
        start: at(day, "22:30"),
        end: at(next, "01:30"),
        category: "activity",
        location: place,
      });
      nightsOut++;
      lateLastNight = true;
    }
  });

  const name = trip.destination.name;
  const scopeLine =
    trip.destination.scope === "city"
      ? `Every day stays in ${stops[0]}, and each day's stops are grouped so you spend time exploring rather than crossing town.`
      : `Because this is a ${trip.destination.scope} trip, the route moves ${stops.join(" → ")}, with travel in the mornings so afternoons stay free.`;
  const bookingBits: string[] = [];
  if (c.arrival) bookingBits.push(`day one starts after your flight lands at ${hhmm(c.arrival.at)}`);
  if (c.departure) bookingBits.push(`the last day wraps up before your ${hhmm(c.departure.at)} departure`);
  if (c.lodging[0]) bookingBits.push(`evenings end near ${c.lodging[0].name} in ${c.lodging[0].neighborhood}`);
  const bookingLine = bookingBits.length ? ` Around your bookings, ${bookingBits.join(", ")}.` : "";
  const nightLine = nightsOut
    ? ` You asked for nightlife, so ${nightsOut === days.length ? "every night" : `${nightsOut} of ${days.length} nights`} end${nightsOut === 1 || nightsOut === days.length ? "s" : ""} with a night out (22:30–01:30), and the mornings after start later.`
    : "";

  return {
    summary: `A ${days.length}-day plan for ${name}. ${scopeLine} Mornings go to sights before the crowds, afternoons to something active or relaxing, and meals land at normal mealtimes.${nightLine}${bookingLine}`,
    highlights: [
      trip.destination.scope === "city"
        ? { title: "Less commuting, more exploring", body: `Each day clusters nearby parts of ${stops[0]} so transit stays short.` }
        : { title: "A route that flows", body: `${stops.join(" → ")}, one direction, with travel mornings and free afternoons.` },
      nightsOut
        ? { title: "Nights out, as you asked", body: `A late night out on ${nightsOut} night${nightsOut === 1 ? "" : "s"}, after dinner, with later starts the next morning.` }
        : { title: "A little of everything", body: "Sights, food, and outdoor time each day, with breathing room between them." },
      bookingBits.length
        ? { title: "Built around your bookings", body: `${bookingBits[0][0].toUpperCase()}${bookingBits[0].slice(1)}.` }
        : { title: "Easy to make your own", body: "Drag anything to a new time, delete what doesn't fit, or add your own plans." },
    ],
    events,
  };
}
