import { HttpError, json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { withinTrip } from "@/lib/events";
import { deleteEvent, getEvent, updateEvent } from "@/lib/store/repo";
import type { TripEvent } from "@/lib/types";
import { eventPatchSchema } from "@/lib/validation";

/** Loads the event and checks that its trip belongs to the current user. */
async function requireEvent(id: string): Promise<{ event: TripEvent; trip: Awaited<ReturnType<typeof requireTrip>> }> {
  const event = await getEvent(id);
  if (!event) throw new HttpError(404, "Event not found");
  const trip = await requireTrip(event.tripId);
  return { event, trip };
}

export const PATCH = route<IdParams>(async (req, { params }) => {
  const { event, trip } = await requireEvent((await params).id);
  const patch = await readBody(req, eventPatchSchema);
  const start = patch.start ?? event.start;
  const end = patch.end ?? event.end;
  if (end <= start) throw new HttpError(400, "End must be after start");
  if (!withinTrip(trip, start, end)) throw new HttpError(400, "Events must fall within the trip dates");
  if (event.source === "booking" && (patch.start || patch.end))
    throw new HttpError(409, "Booking times follow the booking. Change or cancel the booking instead.");
  const updated = await updateEvent(event.id, patch);
  return json({ event: updated });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  const { event } = await requireEvent((await params).id);
  await deleteEvent(event.id);
  return json({ ok: true });
});
