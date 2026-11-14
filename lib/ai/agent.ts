import { FunctionCallingConfigMode, type Content, type FunctionCall, type GenerateContentParameters, type Part } from "@google/genai";
import { addDays, formatRange, hhmm } from "../dates";
import { findRegion } from "../geo";
import type { FlightOption, LodgingOption } from "../providers";
import type { AgentFinal, AgentKind, AgentStep, AgentStepType, Trip } from "../types";
import { Toolbox, toolDeclarations, tripAirport, type ToolOutcome } from "./agent-tools";
import { parseFlightRequest, parseStayRequest, rankFlights, rankStays, type FlightPrefs, type StayPrefs } from "./agent-scoring";
import { callWithRetry, classifyGeminiError, gemini, geminiConfigured, geminiModel, type GeminiDeps } from "./gemini";

/**
 * Booking agent (PLAN.md Section 6.2). `runAgent(ctx, request, emit)` is the only entry point:
 * every thought, tool call, tool result, and the final answer go through `emit`, which the API
 * route persists to `agentRuns.steps` and streams to the browser.
 */

export interface AgentContext {
  trip: Trip;
  kind: AgentKind;
  autoBook: boolean;
}

export type Emit = (step: AgentStep) => Promise<void> | void;

type GenerateResult = { candidates?: { content?: Content }[]; functionCalls?: FunctionCall[]; text?: string };
export interface AgentDeps extends Omit<GeminiDeps, "generate"> {
  generate?: (params: GenerateContentParameters) => Promise<GenerateResult>;
  /** Pause between offline steps so the log reads naturally (0 in tests). */
  stepDelayMs?: number;
}

export interface AgentResult {
  final: AgentFinal;
  mode: "gemini" | "offline";
}

const MAX_ITERATIONS = 8;
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const dur = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

function stepper(emit: Emit) {
  return async (type: AgentStepType, content: unknown) => {
    await emit({ type, content, at: new Date().toISOString() });
  };
}

function finalFrom(out: ToolOutcome, message: string): AgentFinal {
  if (out.stop === "awaiting_confirmation") return { status: "awaiting_confirmation", message, proposal: out.proposal };
  return { status: "booked", message, booking: out.booking };
}

/** Where a state/country trip should be based. */
export function baseCity(trip: Trip): string {
  if (trip.destination.scope === "city") return trip.destination.name;
  const region = findRegion(trip.destination.name);
  return region ? `${region.stops[0]}, ${region.country}` : `${tripAirport(trip).city}`;
}

export async function runAgent(ctx: AgentContext, request: string, emit: Emit, deps: AgentDeps = {}): Promise<AgentResult> {
  const step = stepper(emit);
  if (geminiConfigured() || deps.generate) {
    try {
      return { final: await geminiAgent(ctx, request, step, deps), mode: "gemini" };
    } catch (err) {
      const e = classifyGeminiError(err);
      console.error(`[agent] Gemini failed (${e.kind}); using the offline agent.`, e.message);
      await step("thought", { text: `Gemini is unavailable right now (${e.kind.replace("_", " ")}), so I'm switching to the offline agent for this search.` });
    }
  }
  return { final: await offlineAgent(ctx, request, step, deps), mode: "offline" };
}

// ---------------- Gemini ----------------

function systemPrompt(ctx: AgentContext): string {
  const { trip, kind } = ctx;
  const d = trip.destination;
  const airport = tripAirport(trip);
  const lines = [
    `You are Tripaholic's booking agent. You ${kind === "flight" ? "find and book the best flight" : "find and book the best place to stay"} for this trip, using only your tools.`,
    `Trip: "${trip.title}" to ${d.name} (scope: ${d.scope}), ${trip.startDate} to ${trip.endDate}. Destination time zone ${d.timezone}.`,
    kind === "flight"
      ? `Suggested arrival airport: ${airport.code} (${airport.city}). Round trip: depart so the traveler arrives by ${trip.startDate} (long-haul flights may need to leave the day before) and return on ${trip.endDate}.`
      : `Suggested base: ${baseCity(trip)}. Default dates: check in ${trip.startDate}, check out ${trip.endDate > trip.startDate ? trip.endDate : addDays(trip.endDate, 1)}.`,
    d.scope !== "city"
      ? `This is a ${d.scope} trip: choose a sensible ${kind === "flight" ? "arrival airport" : "base city"} for it and say why in one sentence.`
      : "",
    "How to work:",
    "- Before each tool call, write one short sentence saying what you are about to do and why.",
    `- Search, compare the options against the traveler's request (price, times, ${kind === "flight" ? "stops, duration" : "rating, location, amenities"}), and pick the single best match.`,
    `- Then call ${kind === "flight" ? "book_flight" : "book_lodging"} with that id and a 2-3 sentence rationale that cites concrete numbers and the tradeoff versus the runner-up.`,
    "- If nothing matches exactly, relax the least important constraint and say so. Search again at most twice.",
    kind === "flight" ? "- If the request does not say where the traveler flies from, do not guess: reply asking for the origin city, without calling tools." : "",
    "- After booking, reply with one short confirmation sentence.",
    "Prices are USD. All data comes from a demo provider.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function geminiAgent(ctx: AgentContext, request: string, step: ReturnType<typeof stepper>, deps: AgentDeps): Promise<AgentFinal> {
  const toolbox = new Toolbox(ctx.trip, ctx.autoBook);
  const generate = deps.generate ?? ((p: GenerateContentParameters) => gemini().models.generateContent(p));
  const contents: Content[] = [{ role: "user", parts: [{ text: request }] }];
  const config = (noTools = false): GenerateContentParameters["config"] => ({
    systemInstruction: systemPrompt(ctx),
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(60_000),
    tools: [{ functionDeclarations: toolDeclarations(ctx.kind) }],
    ...(noTools ? { toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } } } : {}),
  });
  const call = (noTools = false) => callWithRetry(() => generate({ model: geminiModel(), contents, config: config(noTools) }), deps);
  const textOf = (c?: Content) =>
    (c?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await call();
    const content = res.candidates?.[0]?.content;
    if (content) contents.push({ role: "model", parts: content.parts ?? [] });
    const text = textOf(content);
    const calls = res.functionCalls ?? [];

    if (!calls.length) {
      const final: AgentFinal = { status: "failed", message: text || "I couldn't find a booking for that request. Try adding more detail." };
      await step("final", final);
      return final;
    }
    if (text) await step("thought", { text });

    const responses: Part[] = [];
    let stop: ToolOutcome | undefined;
    for (const fc of calls) {
      const name = fc.name ?? "";
      await step("tool_call", { name, args: fc.args ?? {} });
      const out = await toolbox.exec(name, fc.args ?? {});
      await step("tool_result", { name, summary: out.summary, options: out.options, booking: out.booking, error: out.error });
      responses.push({ functionResponse: { id: fc.id, name, response: out.response } });
      if (out.stop) {
        stop = out;
        break;
      }
    }
    contents.push({ role: "user", parts: responses });

    if (stop?.stop === "awaiting_confirmation") {
      const p = stop.proposal!;
      const final = finalFrom(stop, `My pick: ${describeOption(p.option)}. ${p.rationale} Confirm below to book it.`);
      await step("final", final);
      return final;
    }
    if (stop?.stop === "booked") {
      let closing = "";
      try {
        closing = textOf((await call(true)).candidates?.[0]?.content);
      } catch {
        /* the booking is done; a closing line is optional */
      }
      const final = finalFrom(stop, closing || `${stop.summary}. It's on your itinerary.`);
      await step("final", final);
      return final;
    }
  }
  const final: AgentFinal = { status: "failed", message: `I couldn't finish within ${MAX_ITERATIONS} steps. Try a more specific request.` };
  await step("final", final);
  return final;
}


function describeOption(o: FlightOption | LodgingOption): string {
  return "outbound" in o ? `${o.airline} ${o.outbound.flightNumber} for ${money(o.price)}` : `${o.name} for ${money(o.totalPrice)}`;
}

// ---------------- Offline ----------------

function describeFlightPrefs(p: FlightPrefs): string {
  const bits = [p.goal === "cheapest" ? "the cheapest" : p.goal === "fastest" ? "the fastest" : "the best-value", p.nonstop ? "nonstop" : "", p.cabin ?? "", "flight"];
  if (p.arriveBefore) bits.push(`landing before ${p.arriveBefore}`);
  if (p.departAfter) bits.push(`leaving after ${p.departAfter}`);
  if (p.avoidRedEye) bits.push("(no red-eyes)");
  return bits.filter(Boolean).join(" ");
}

function flightRationale(best: FlightOption, ranked: ReturnType<typeof rankFlights>, all: FlightOption[], p: FlightPrefs): string {
  const o = best.outbound;
  const runnerUp = ranked.eligible[1];
  const cheapest = all.reduce((a, b) => (a.price <= b.price ? a : b));
  const parts = [
    `${best.airline} ${o.flightNumber} fits best: ${money(best.price)} round trip, leaves ${o.from} at ${hhmm(o.depart)} and lands at ${o.to} at ${hhmm(o.arrive)} on ${o.arrive.slice(5, 10)} (${dur(o.durationMinutes)}, ${o.stops === 0 ? "nonstop" : `${o.stops} stop${o.stops > 1 ? "s" : ""} via ${o.via}`}).`,
  ];
  if (runnerUp) {
    const diff = runnerUp.price - best.price;
    parts.push(
      p.goal === "fastest"
        ? `It's ${dur(Math.abs(runnerUp.outbound.durationMinutes - o.durationMinutes))} quicker than the next option (${runnerUp.airline}).`
        : diff > 0
          ? `That's ${money(diff)} less than the next match, ${runnerUp.airline} ${runnerUp.outbound.flightNumber}.`
          : `The next match, ${runnerUp.airline}, costs about the same but is ${runnerUp.outbound.durationMinutes > o.durationMinutes ? "slower" : "less convenient"}.`,
    );
  }
  if (cheapest.id !== best.id) parts.push(`The cheapest fare overall (${money(cheapest.price)}, ${cheapest.airline}) didn't meet your request.`);
  return parts.join(" ");
}

function stayRationale(best: LodgingOption, ranked: ReturnType<typeof rankStays>, p: StayPrefs): string {
  const runnerUp = ranked.eligible[1];
  const parts = [
    `${best.name} (${best.type === "airbnb" ? "entire home" : "hotel"}) in ${best.neighborhood.split(",")[0]} is the best match: rated ${best.rating} from ${best.reviews} reviews, ${money(best.nightlyPrice)}/night (${money(best.totalPrice)} for ${best.nights} night${best.nights === 1 ? "" : "s"}), ${best.distanceKm} km from the center.`,
  ];
  const wanted = p.amenities.filter((a) => best.amenities.includes(a));
  if (wanted.length) parts.push(`It has ${wanted.join(" and ").toLowerCase()}, as you asked.`);
  if (runnerUp)
    parts.push(
      runnerUp.nightlyPrice < best.nightlyPrice
        ? `${runnerUp.name} is ${money(best.nightlyPrice - runnerUp.nightlyPrice)}/night cheaper but rated ${runnerUp.rating}${runnerUp.distanceKm > best.distanceKm ? ` and ${runnerUp.distanceKm} km out` : ""}.`
        : `The runner-up, ${runnerUp.name}, costs ${money(runnerUp.nightlyPrice - best.nightlyPrice)}/night more.`,
    );
  return parts.join(" ");
}

async function offlineAgent(ctx: AgentContext, request: string, step: ReturnType<typeof stepper>, deps: AgentDeps): Promise<AgentFinal> {
  const { trip } = ctx;
  const toolbox = new Toolbox(trip, ctx.autoBook);
  const delay = deps.stepDelayMs ?? 450;
  const pause = () => (delay ? new Promise((r) => setTimeout(r, delay)) : Promise.resolve());
  const say = async (text: string) => {
    await pause();
    await step("thought", { text });
  };
  const use = async (name: string, args: Record<string, unknown>) => {
    await pause();
    await step("tool_call", { name, args });
    const out = await toolbox.exec(name, args);
    await step("tool_result", { name, summary: out.summary, options: out.options, booking: out.booking, error: out.error });
    return out;
  };
  const finish = async (final: AgentFinal) => {
    await pause();
    await step("final", final);
    return final;
  };

  if (ctx.kind === "flight") {
    const p = parseFlightRequest(request);
    if (!p.origin) return finish({ status: "failed", message: 'Where are you flying from? Try something like "cheapest direct flight from JFK arriving before noon".' });
    const dest = tripAirport(trip);
    await say(
      `Looking for ${describeFlightPrefs(p)} from ${p.origin} to ${dest.city} (${dest.code}) for ${p.passengers} passenger${p.passengers > 1 ? "s" : ""}, ${formatRange(trip.startDate, trip.endDate)}.` +
        (trip.destination.scope !== "city" ? ` For a ${trip.destination.scope} trip, ${dest.city} is the best-connected gateway.` : ""),
    );
    const args = { origin: p.origin, destination: dest.code, departDate: trip.startDate, returnDate: trip.endDate, passengers: p.passengers, ...(p.cabin ? { cabin: p.cabin } : {}) };
    let out = await use("search_flights", args);
    if (out.error) return finish({ status: "failed", message: out.error });
    let options = out.options as FlightOption[];
    // Arrival goals ("before noon") mean on the first day of the trip.
    let ranked = rankFlights(options, p, trip.startDate);
    const landsLate = (r: typeof ranked) => !r.best || r.best.outbound.arrive.slice(0, 10) > trip.startDate || r.relaxed.some((l) => l.startsWith("lands"));
    if (landsLate(ranked)) {
      await say(`None of those land on ${trip.startDate}${p.arriveBefore ? ` by ${p.arriveBefore}` : ""}, so I'm checking flights a day earlier so you arrive on day one.`);
      const earlier = await use("search_flights", { ...args, departDate: addDays(trip.startDate, -1) });
      const r2 = earlier.error ? undefined : rankFlights(earlier.options as FlightOption[], p, trip.startDate);
      if (r2 && !landsLate(r2)) {
        out = earlier;
        options = earlier.options as FlightOption[];
        ranked = r2;
      }
    }
    if (!ranked.best) return finish({ status: "failed", message: "No flights came back for that route. Try another origin airport." });
    await say(
      `${ranked.eligible.length} of ${options.length} options fit${ranked.applied.length ? ` (${ranked.applied.join(", ")})` : ""}.` +
        (ranked.relaxed.length ? ` None were ${ranked.relaxed.join(" and ")}, so I relaxed that.` : "") +
        ` Ranking them by ${p.goal === "cheapest" ? "price" : p.goal === "fastest" ? "travel time" : "price, time, and stops together"}.`,
    );
    const rationale = flightRationale(ranked.best, ranked, options, p);
    await say(rationale);
    const booked = await use("book_flight", { optionId: ranked.best.id, rationale });
    if (booked.error) return finish({ status: "failed", message: booked.error });
    return finish(
      finalFrom(
        booked,
        booked.stop === "awaiting_confirmation"
          ? `My pick: ${describeOption(ranked.best)}. Confirm below to book it.`
          : `${booked.summary}. The flights are on your itinerary.`,
      ),
    );
  }

  const p = parseStayRequest(request);
  const base = baseCity(trip);
  const location = p.area ? `${p.area}, ${base.split(",")[0]}` : base;
  await say(
    `Looking for ${p.goal === "cheapest" ? "the cheapest" : p.goal === "top_rated" ? "the best-rated" : p.goal === "central" ? "the most central" : "the best-value"} ${p.type === "airbnb" ? "home" : p.type === "hotel" ? "hotel" : "stay"} in ${location.split(",")[0]} for ${p.guests} guest${p.guests > 1 ? "s" : ""}` +
      (p.budget ? `, under $${p.budget}/night` : "") +
      (p.amenities.length ? `, with ${p.amenities.join(", ").toLowerCase()}` : "") +
      "." +
      (trip.destination.scope !== "city" && !p.area ? ` For a ${trip.destination.scope} trip I'm basing you in ${base.split(",")[0]}, the usual starting point.` : ""),
  );
  const out = await use("search_lodging", { location, guests: p.guests, ...(p.budget ? { budget: p.budget } : {}), ...(p.type ? { type: p.type } : {}) });
  if (out.error) return finish({ status: "failed", message: out.error });
  const options = out.options as LodgingOption[];
  const ranked = rankStays(options, p);
  if (!ranked.best) return finish({ status: "failed", message: "No stays came back for that area. Try a nearby city." });
  await say(
    `${ranked.eligible.length} of ${options.length} stays fit${ranked.applied.length ? ` (${ranked.applied.join(", ")})` : ""}.` +
      (ranked.relaxed.length ? ` None were ${ranked.relaxed.join(" and ")}, so I relaxed that.` : ""),
  );
  const rationale = stayRationale(ranked.best, ranked, p);
  await say(rationale);
  const booked = await use("book_lodging", { propertyId: ranked.best.id, rationale });
  if (booked.error) return finish({ status: "failed", message: booked.error });
  return finish(
    finalFrom(
      booked,
      booked.stop === "awaiting_confirmation" ? `My pick: ${describeOption(ranked.best)}. Confirm below to book it.` : `${booked.summary}. Check-in and check-out are on your itinerary.`,
    ),
  );
}
