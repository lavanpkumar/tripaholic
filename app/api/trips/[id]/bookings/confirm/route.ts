import { HttpError, json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import type { Proposal } from "@/lib/ai/agent-tools";
import { bookFlight, bookLodging, defaultStay } from "@/lib/bookings";
import type { FlightOption, LodgingOption } from "@/lib/providers";
import { appendStep, getRun } from "@/lib/store/repo";
import type { AgentFinal, AgentStep } from "@/lib/types";
import { confirmSchema } from "@/lib/validation";

/** Books the option the agent proposed when auto-book was off (the "Confirm booking" card). */
export const POST = route<IdParams>(async (req, { params }) => {
  const trip = await requireTrip((await params).id);
  const { runId, optionId } = await readBody(req, confirmSchema);
  const run = await getRun(runId);
  if (!run || run.tripId !== trip.id) throw new HttpError(404, "Agent run not found");

  const finalStep = [...run.steps].reverse().find((s) => s.type === "final");
  const final = finalStep?.content as AgentFinal | undefined;
  if (final?.status === "booked") throw new HttpError(409, "This run already booked something");
  const proposal = final?.proposal as Proposal | undefined;
  if (final?.status !== "awaiting_confirmation" || !proposal || proposal.optionId !== optionId)
    throw new HttpError(409, "That option is no longer awaiting confirmation. Ask the agent again.");

  const booking =
    run.kind === "flight"
      ? await bookFlight(trip, proposal.option as FlightOption, proposal.passengers ?? 1, "user", proposal.rationale)
      : await bookLodging(trip, proposal.option as LodgingOption, proposal.stay ?? defaultStay(trip), "user", proposal.rationale);

  const at = new Date().toISOString();
  const steps: AgentStep[] = [
    { type: "tool_call", content: { name: run.kind === "flight" ? "book_flight" : "book_lodging", args: { [run.kind === "flight" ? "optionId" : "propertyId"]: optionId }, confirmedByUser: true }, at },
    { type: "tool_result", content: { name: run.kind === "flight" ? "book_flight" : "book_lodging", summary: `Booked after your confirmation · confirmation ${booking.confirmationCode}`, booking }, at },
    { type: "final", content: { status: "booked", message: `Confirmed and booked. Confirmation ${booking.confirmationCode}; it's on your itinerary.`, booking } satisfies AgentFinal, at },
  ];
  for (const s of steps) await appendStep(run.id, s);
  return json({ booking, steps }, 201);
});
