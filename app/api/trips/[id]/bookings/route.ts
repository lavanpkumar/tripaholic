import { json, requireTrip, route, type IdParams } from "@/lib/api";
import { listBookings } from "@/lib/store/repo";

export const GET = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  return json({ bookings: await listBookings(trip.id) });
});
