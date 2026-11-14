import { json, readBody, route } from "@/lib/api";
import { DEMO_USER_ID } from "@/lib/env";
import { withStatus } from "@/lib/status";
import { createTrip, listTrips } from "@/lib/store/repo";
import { tripCreateSchema } from "@/lib/validation";

export const GET = route(async () => {
  const trips = await listTrips(DEMO_USER_ID);
  return json({ trips: trips.map((t) => withStatus(t)) });
});

export const POST = route(async (req) => {
  const input = await readBody(req, tripCreateSchema);
  const trip = await createTrip({ ...input, userId: DEMO_USER_ID, archived: false });
  return json({ trip: withStatus(trip) }, 201);
});
