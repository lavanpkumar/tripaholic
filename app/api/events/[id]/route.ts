import { HttpError, json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { eventTimesError, withinTrip } from "@/lib/events";
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
  // Booking blocks can be renamed or annotated, but their times follow the booking.
  // Forms resend unchanged times, so only a real change is rejected.
  if (event.source === "booking" && (start !== event.start || end !== event.end))
    throw new HttpError(409, "Booking times follow the booking. Change or cancel the booking instead.");
  // A patch may carry only one side, so check the merged times (only when they actually change,
  // so renaming an existing event never fails).
  if (start !== event.start || end !== event.end) {
    const msg = eventTimesError(start, end);
    if (msg) throw new HttpError(400, msg);
  }
  if (!withinTrip(trip, start, end)) throw new HttpError(400, "Events must fall within the trip dates");
  // Moving or editing an AI suggestion means the traveler wants it: pin it so Regenerate keeps it.
  if (event.source === "ai" && patch.pinned === undefined) {
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => patch[k] !== undefined && patch[k] !== event[k as keyof typeof event]);
    if (changed) patch.pinned = true;
  }
  const updated = await updateEvent(event.id, patch);
  return json({ event: updated });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  const { event } = await requireEvent((await params).id);
  await deleteEvent(event.id);
  return json({ ok: true });
});
