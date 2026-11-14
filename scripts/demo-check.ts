/**
 * Runs the PLAN.md Section 11 demo flow against a running server, end to end, N times:
 *   npm run demo:check -- [baseUrl] [--runs 3] [--keep]
 * Each run creates a Tokyo city trip, books a flight and a hotel through the agent, generates the
 * itinerary, moves/deletes/adds events, regenerates, and checks the user event survived.
 * The created trip is deleted afterwards unless --keep is given.
 */

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith("http")) ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(args[args.indexOf("--runs") + 1]) || (args.includes("--runs") ? 3 : 1);
const KEEP = args.includes("--keep");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- loose JSON from our own API

class CheckError extends Error {}
function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new CheckError(msg);
}

async function call(method: string, path: string, body?: unknown): Promise<Json> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  check(res.ok, `${method} ${path} -> ${res.status} ${data.error ?? text.slice(0, 120)}`);
  return data;
}

async function page(path: string, mustContain: string[]) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  check(res.ok, `GET ${path} -> ${res.status}`);
  for (const s of mustContain) check(html.includes(s), `GET ${path} is missing "${s}"`);
}

async function agent(tripId: string, kind: "flight" | "lodging", request: string): Promise<Json[]> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, request, autoBook: true }),
  });
  check(res.ok && res.headers.get("content-type")?.includes("text/event-stream"), `agent ${kind} did not stream (${res.status})`);
  const raw = await res.text();
  const steps = raw
    .split("\n\n")
    .filter((b) => b.startsWith("event: step"))
    .map((b) => JSON.parse(b.slice(b.indexOf("data: ") + 6)));
  return steps;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));
const overlap = (a: Json, b: Json) => a.start < b.end && b.start < a.end;

async function runOnce(n: number): Promise<number> {
  const t0 = Date.now();
  const log = (s: string) => console.log(`  [${n}] ${((Date.now() - t0) / 1000).toFixed(1)}s  ${s}`);

  // 1. Home shows all three sections, each with a trip.
  const { trips } = await call("GET", "/api/trips");
  for (const status of ["planned", "in_progress", "archived"]) check(trips.some((t: Json) => t.status === status), `no ${status} trip on the home page (run npm run seed)`);
  await page("/", ["Planned Trips", "In-progress Trips", "Archived Trips"]);
  log("home: planned, in-progress, archived all present");

  // 2. New trip: Tokyo, City scope, a few weeks out.
  const startDate = plusDays(21);
  const endDate = plusDays(24);
  const { trip } = await call("POST", "/api/trips", {
    title: `Demo check ${n}: Tokyo`,
    destination: { name: "Tokyo, Japan", scope: "city", timezone: "Asia/Tokyo", lat: 35.6895, lng: 139.6917, country: "Japan" },
    startDate,
    endDate,
  });
  check(trip.status === "planned", "new trip is not planned");
  await page(`/trips/${trip.id}?tab=flights`, ["Find your way there", "Agent log"]);
  log(`created trip ${trip.id}`);

  try {
    // 3. Flights: search, compare, explain, book.
    const fSteps = await agent(trip.id, "flight", "cheapest direct flight from JFK arriving before noon");
    const types = fSteps.map((s) => s.type);
    check(types.includes("thought") && types.includes("tool_call") && types.includes("tool_result"), "flight run missing thought/tool steps");
    const fFinal = fSteps.at(-1)!.content;
    check(fFinal.status === "booked", `flight not booked: ${fFinal.message}`);
    const rationale = fSteps.find((s) => s.type === "tool_call" && s.content.name === "book_flight")?.content.args.rationale;
    check(typeof rationale === "string" && rationale.length > 20, "booking has no rationale");
    log(`flight booked: ${fFinal.booking.details.airline} ${fFinal.booking.details.outbound.flightNumber}, ${fFinal.booking.confirmationCode}`);

    // 4. Lodging.
    const lFinal = (await agent(trip.id, "lodging", "best rated hotel near the center with breakfast")).at(-1)!.content;
    check(lFinal.status === "booked", `stay not booked: ${lFinal.message}`);
    log(`stay booked: ${lFinal.booking.details.name}, ${lFinal.booking.confirmationCode}`);
    const { bookings } = await call("GET", `/api/trips/${trip.id}/bookings`);
    check(bookings.length === 2, `expected 2 bookings, got ${bookings.length}`);

    // 5. Itinerary: generate around the bookings.
    const gen = await call("POST", `/api/trips/${trip.id}/itinerary/generate`, {});
    const ai = gen.events.filter((e: Json) => e.source === "ai");
    const fixed = gen.events.filter((e: Json) => e.source !== "ai");
    check(ai.length >= 4, `only ${ai.length} AI events`);
    check(fixed.some((e: Json) => e.source === "booking"), "no booking blocks on the calendar");
    for (const e of ai) check(!fixed.some((f: Json) => overlap(e, f)), `AI event "${e.title}" overlaps a booking`);
    for (const e of gen.events) check(e.start >= `${startDate}T00:00:00` && e.end <= `${plusDays(25)}T00:00:00`, `event "${e.title}" is outside the trip`);
    const landing = fFinal.booking.details.arrivalAtDestination as string;
    for (const e of ai) check(e.start >= landing, `AI event "${e.title}" is before the flight lands`);
    check(gen.summary.summary.length > 40, "summary missing");
    await page(`/trips/${trip.id}?tab=itinerary`, ["Why this plan", "Regenerate with AI"]);
    log(`itinerary: ${ai.length} AI events around ${fixed.length} booking blocks (${gen.summary.mode})`);

    // 6. Move one, delete one, add one of your own, regenerate.
    const [toMove, toDelete] = ai;
    const moved = await call("PATCH", `/api/events/${toMove.id}`, { start: toMove.start.replace(/T\d\d:\d\d/, "T21:00"), end: toMove.start.replace(/T\d\d:\d\d/, "T22:00") });
    check(moved.event.start.endsWith("21:00:00"), "move did not persist");
    await call("DELETE", `/api/events/${toDelete.id}`);
    const mine = (await call("POST", `/api/trips/${trip.id}/events`, { title: "Dinner with friends", start: `${plusDays(22)}T19:30`, end: `${plusDays(22)}T21:30`, category: "food" })).event;
    const regen = await call("POST", `/api/trips/${trip.id}/itinerary/generate`, {});
    const kept = regen.events.find((e: Json) => e.id === mine.id);
    check(kept && kept.start === mine.start && kept.end === mine.end && kept.source === "user", "user event did not survive regenerate");
    for (const e of regen.events.filter((x: Json) => x.source === "ai")) check(!overlap(e, mine), `AI event "${e.title}" overlaps the user event`);
    log("moved, deleted, added; regenerate kept the user event");

    // 7. Home shows the new trip under Planned.
    const after = (await call("GET", "/api/trips")).trips.find((t: Json) => t.id === trip.id);
    check(after?.status === "planned", "new trip not under Planned");
    await page("/", [trip.title]);
    log("home lists the new trip under Planned");
  } finally {
    if (!KEEP) await call("DELETE", `/api/trips/${trip.id}`).catch(() => {});
  }
  return (Date.now() - t0) / 1000;
}

async function main() {
  console.log(`Demo flow check against ${BASE}, ${RUNS} run(s)`);
  const times: number[] = [];
  for (let i = 1; i <= RUNS; i++) times.push(await runOnce(i));
  console.log(`PASS: ${RUNS} run(s), ${times.map((t) => `${t.toFixed(1)}s`).join(", ")}`);
}

main().catch((err) => {
  console.error(`FAIL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
