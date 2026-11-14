import { HttpError, json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { withStatus } from "@/lib/status";
import { withinTrip } from "@/lib/events";
import { deleteTrip, listEvents, updateTrip } from "@/lib/store/repo";
import { dateRangeError, tripPatchSchema } from "@/lib/validation";

export const GET = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  return json({ trip: withStatus(trip) });
});

export const PATCH = route<IdParams>(async (req, { params }) => {
  const trip = await requireTrip((await params).id);
  const patch = await readBody(req, tripPatchSchema);
  const range = { startDate: patch.startDate ?? trip.startDate, endDate: patch.endDate ?? trip.endDate };
  const msg = dateRangeError(range.startDate, range.endDate);
  if (msg) throw new HttpError(400, msg);
  if (range.startDate > trip.startDate || range.endDate < trip.endDate) {
    // Shrinking the trip must not silently orphan events outside the new dates.
    const outside = (await listEvents(trip.id)).filter((e) => !withinTrip(range, e.start, e.end));
    if (outside.length)
      throw new HttpError(409, `${outside.length} event${outside.length === 1 ? " falls" : "s fall"} outside the new dates. Move or delete ${outside.length === 1 ? "it" : "them"} first.`);
  }
  const updated = await updateTrip(trip.id, patch);
  return json({ trip: withStatus(updated!) });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  await deleteTrip(trip.id);
  return json({ ok: true });
});
