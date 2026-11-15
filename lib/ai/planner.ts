import { z } from "zod";
import { addDays, eachDay, formatDay } from "../dates";
import { env } from "../env";
import { EVENT_CATEGORIES } from "../types";
import { buildConstraints, type DerivedConstraints, type PlannerContext } from "./context";
import { GeminiError, classifyGeminiError, generateJson, geminiConfigured, type GeminiDeps } from "./gemini";
import { offlinePlan } from "./offline-planner";
import { postprocessPlan, type PlannedEvent } from "./postprocess";

/** Itinerary planner (PLAN.md Section 6.1): Gemini structured output, with the offline planner as fallback. */

export interface Plan {
  summary: string;
  highlights: { title: string; body: string }[];
  events: PlannedEvent[];
  mode: "gemini" | "offline";
  grounded: boolean;
  /** Shown to the user when the plan did not come from Gemini as intended. */
  notice?: string;
  stats: { proposed: number; kept: number; moved: number };
}

const planZ = z.object({
  summary: z.string().trim().min(1).max(3000),
  highlights: z
    .array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(400) }))
    .max(4)
    .default([]),
  events: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string(),
        end: z.string(),
        category: z.string(),
        reason: z.string(),
      }),
    )
    .min(1)
    .max(150),
});

const planJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "3-5 sentences: the overall plan, why it was chosen, how the trip scope shaped it." },
    highlights: {
      type: "array",
      description: "2-3 short themes behind the plan.",
      items: {
        type: "object",
        properties: { title: { type: "string", description: "6 words max" }, body: { type: "string", description: "30 words max" } },
        required: ["title", "body"],
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          location: { type: "string", description: "Neighborhood or venue, and the city" },
          start: { type: "string", description: "Local time YYYY-MM-DDTHH:mm" },
          end: { type: "string", description: "Local time YYYY-MM-DDTHH:mm" },
          category: { type: "string", enum: [...EVENT_CATEGORIES] },
          reason: { type: "string", description: "1-2 sentences: why this, at this time, for this traveler" },
        },
        required: ["title", "start", "end", "category", "reason"],
      },
    },
  },
  required: ["summary", "highlights", "events"],
} as const;

const SCOPE_RULE = {
  city: "CITY trip: every event stays inside this one city (day trips only if very close). Group each day's events by neighborhood.",
  state:
    "STATE trip: spread the trip across 2-4 cities or regions within this state, in a sensible geographic order. Add explicit category=travel events for moves between them with realistic durations and mode (train, drive, ferry). Group each day's events in one area.",
  country:
    "COUNTRY trip: build a multi-city route across 2-5 cities or regions in this country, in a sensible geographic order. Add explicit category=travel events for moves between them with realistic durations and mode (train, flight, drive). Group each day's events in one area.",
} as const;

export function buildPrompt(ctx: PlannerContext, c: DerivedConstraints): { system: string; prompt: string } {
  const { trip } = ctx;
  const d = trip.destination;
  const system = [
    "You are Tripaholic's itinerary planner. You plan realistic, enjoyable days and explain your choices plainly.",
    "Rules:",
    `- Times are local wall-clock time at the destination (${d.timezone}), format YYYY-MM-DDTHH:mm with no offset.`,
    `- Every event starts between ${trip.startDate}T00:00 and ${trip.endDate}T23:59. An evening event (starting at 18:00 or later) may end as late as 03:00 the next morning, written with the next day's date (e.g. ${trip.endDate}T22:30 to ${addDays(trip.endDate, 1)}T01:30). Daytime events end by 23:00.`,
    "- Never overlap the FIXED events listed by the user; they are the traveler's own plans or bookings. Plan around them and do not repeat them.",
    c.earliest ? `- The traveler lands at ${c.arrival!.at.slice(0, 16)}; schedule nothing before ${c.earliest.slice(0, 16)}.` : "",
    c.latest ? `- The traveler leaves for the airport at ${c.latest.slice(0, 16)}; schedule nothing after that.` : "",
    "- Pace: 2-4 events per day normally (fewer on arrival/departure days); up to 5 on a day when the traveler's request needs it. Meals at mealtimes (lunch 12:00-14:00, dinner 18:30-21:00). Sights and outdoor activities in the morning or late afternoon. Leave gaps for rest and getting around.",
    "- Late evening and nightlife are allowed: bars, clubs, live music, night markets, roughly 21:30-02:00. After a late night, start the next day later (a late breakfast or brunch, nothing before about 10:00).",
    ctx.preferences
      ? "- The traveler's request (below) must clearly shape the plan: if they ask for something, include it on the relevant days at the right time of day (e.g. clubbing means late-night events on most nights), and say how it shaped the plan in the summary."
      : "",
    `- ${SCOPE_RULE[d.scope]}`,
    "- Suggest real, well-known places. Do not invent precise opening hours, prices, or reservation details.",
    `- category is one of: ${EVENT_CATEGORIES.join(", ")}.`,
    "- reason: 1-2 sentences specific to this trip explaining why this event is here at this time.",
    `- summary: 3-5 sentences on the overall plan and how the ${d.scope} scope shaped it; mention the bookings if there are any.`,
    "- highlights: 2-3 short themes, each with a title of 6 words max and a body of 30 words max.",
    "Reply with JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const days = eachDay(trip.startDate, trip.endDate).map((day) => `- ${formatDay(day)} (${day})`);
  const bookings: string[] = [];
  if (c.arrival) bookingLine(bookings, `Arriving flight ${c.arrival.flight.airline} ${c.arrival.flight.outbound.flightNumber} lands ${c.arrival.at.slice(0, 16)} local.`);
  if (c.departure) bookingLine(bookings, `Return flight departs ${c.departure.at.slice(0, 16)} local.`);
  for (const l of c.lodging)
    bookingLine(bookings, `Staying at ${l.name} (${l.type}) in ${l.neighborhood}${l.address ? `, ${l.address}` : ""}, ${l.checkIn} to ${l.checkOut}. Prefer evening plans near here.`);
  const fixed = ctx.fixedEvents.map((e) => `- ${e.start.slice(0, 16)} to ${e.end.slice(0, 16)}: ${e.title} (${e.source === "booking" ? "booking" : e.source === "ai" ? "a suggestion the traveler kept" : "traveler's own plan"})`);

  const prompt = [
    `Destination: ${d.name}${d.country && !d.name.includes(d.country) ? `, ${d.country}` : ""}`,
    `Scope: ${d.scope}`,
    `Trip: "${trip.title}", ${trip.startDate} to ${trip.endDate}`,
    "Days:",
    ...days,
    bookings.length ? "Bookings:" : "Bookings: none yet.",
    ...bookings,
    fixed.length ? "FIXED events (do not overlap):" : "FIXED events: none.",
    ...fixed,
    ctx.preferences ? `TRAVELER'S REQUEST (must shape the plan): ${ctx.preferences}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, prompt };
}

function bookingLine(list: string[], s: string) {
  list.push(`- ${s}`);
}

function noticeFor(err: GeminiError): string {
  switch (err.kind) {
    case "auth":
      return "Gemini rejected the API key, so this plan comes from the offline planner.";
    case "rate_limit":
      return "Gemini is rate-limited right now, so this plan comes from the offline planner. Try regenerating in a minute.";
    case "timeout":
      return "Gemini took too long to answer, so this plan comes from the offline planner. Try regenerating.";
    case "invalid_output":
      return "Gemini's plan could not be used, so this one comes from the offline planner. Try regenerating.";
    default:
      return "Gemini was unavailable, so this plan comes from the offline planner. Try regenerating.";
  }
}

export const OFFLINE_NOTICE = "No Gemini key is configured, so this plan comes from the offline planner: the shape of good days, not specific venues.";

export async function planItinerary(ctx: PlannerContext, deps?: GeminiDeps): Promise<Plan> {
  const c = buildConstraints(ctx);
  let notice = OFFLINE_NOTICE;

  if (geminiConfigured() || deps?.generate) {
    try {
      const { system, prompt } = buildPrompt(ctx, c);
      const { data, grounded } = await generateJson({ system, prompt, jsonSchema: planJsonSchema, validate: planZ, grounding: env.grounding, temperature: 0.8 }, deps);
      const pp = postprocessPlan(data.events, c);
      if (pp.events.length === 0) throw new GeminiError("invalid_output", "No usable events after post-processing");
      return {
        summary: data.summary,
        highlights: data.highlights.slice(0, 3),
        events: pp.events,
        mode: "gemini",
        grounded,
        stats: { proposed: data.events.length, kept: pp.events.length, moved: pp.moved },
      };
    } catch (err) {
      const e = classifyGeminiError(err);
      console.error(`[planner] Gemini failed (${e.kind}); using the offline planner.`, e.message);
      notice = noticeFor(e);
    }
  }

  const draft = offlinePlan(ctx, c);
  const pp = postprocessPlan(draft.events, c);
  return {
    summary: draft.summary,
    highlights: draft.highlights,
    events: pp.events,
    mode: "offline",
    grounded: false,
    notice,
    stats: { proposed: draft.events.length, kept: pp.events.length, moved: pp.moved },
  };
}

