import { HttpError, json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { withStatus } from "@/lib/status";
import { deleteTrip, updateTrip } from "@/lib/store/repo";
import { dateRangeError, tripPatchSchema } from "@/lib/validation";

export const GET = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  return json({ trip: withStatus(trip) });
});

export const PATCH = route<IdParams>(async (req, { params }) => {
  const trip = await requireTrip((await params).id);
  const patch = await readBody(req, tripPatchSchema);
  const msg = dateRangeError(patch.startDate ?? trip.startDate, patch.endDate ?? trip.endDate);
  if (msg) throw new HttpError(400, msg);
  const updated = await updateTrip(trip.id, patch);
  return json({ trip: withStatus(updated!) });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  await deleteTrip(trip.id);
  return json({ ok: true });
});
