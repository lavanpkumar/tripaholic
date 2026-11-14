import { HttpError, json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { withinTrip } from "@/lib/events";
import { createEvents, listEvents } from "@/lib/store/repo";
import { eventCreateSchema } from "@/lib/validation";

export const GET = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  return json({ events: await listEvents(trip.id) });
});

/** Creates a user event. AI events come from the planner, booking events from the agent. */
export const POST = route<IdParams>(async (req, { params }) => {
  const trip = await requireTrip((await params).id);
  const input = await readBody(req, eventCreateSchema);
  if (!withinTrip(trip, input.start, input.end)) throw new HttpError(400, "Events must fall within the trip dates");
  const [event] = await createEvents([{ ...input, tripId: trip.id, source: "user" }]);
  return json({ event }, 201);
});
