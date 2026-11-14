import { requireTrip, route, type IdParams } from "@/lib/api";
import { toIcs } from "@/lib/ics";
import { listEvents } from "@/lib/store/repo";

/** Download the itinerary as an .ics file for Google / Apple / Outlook calendars. */
export const GET = route<IdParams>(async (_req, { params }) => {
  const trip = await requireTrip((await params).id);
  const body = toIcs(trip, await listEvents(trip.id));
  const filename = `${trip.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "itinerary"}.ics`;
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
