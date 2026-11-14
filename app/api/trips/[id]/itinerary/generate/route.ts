import { json, readBody, requireTrip, route, type IdParams } from "@/lib/api";
import { generateItinerary } from "@/lib/ai/itinerary";
import { generateSchema } from "@/lib/validation";

/** Runs the planner and replaces only `source: "ai"` events; saves the summary. */
export const POST = route<IdParams>(async (req, { params }) => {
  const trip = await requireTrip((await params).id);
  const { preferences } = await readBody(req, generateSchema);
  const { events, summary, plan } = await generateItinerary(trip, { preferences });
  return json({ events, summary, stats: plan.stats, grounded: plan.grounded });
});
