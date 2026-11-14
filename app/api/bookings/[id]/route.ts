import { HttpError, json, requireTrip, route, type IdParams } from "@/lib/api";
import { deleteBooking, getBooking } from "@/lib/store/repo";

/** Cancels a (demo) booking and removes its itinerary blocks. */
export const DELETE = route<IdParams>(async (_req, { params }) => {
  const booking = await getBooking((await params).id);
  if (!booking) throw new HttpError(404, "Booking not found");
  await requireTrip(booking.tripId);
  await deleteBooking(booking.id);
  return json({ ok: true });
});
