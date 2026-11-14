import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import TripActions from "@/components/trip/TripActions";
import { ScopeChip } from "@/components/trips/TripCards";
import { formatRange, gmtLabel, tripLengthDays } from "@/lib/dates";
import { DEMO_USER_ID } from "@/lib/env";
import { withStatus } from "@/lib/status";
import { getSummary, getTrip, listEvents } from "@/lib/store/repo";
import ItineraryView from "@/components/itinerary/ItineraryView";

const TABS = [
  { id: "flights", label: "Flights", icon: "/assets/flights.svg" },
  { id: "lodging", label: "Lodging", icon: "/assets/lodging.svg" },
  { id: "itinerary", label: "Itinerary", icon: "/assets/itinerary.svg" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATUS_LABEL = { planned: "Planned", in_progress: "In progress", archived: "Archived" } as const;

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const found = await getTrip(id, DEMO_USER_ID);
  if (!found) notFound();
  const trip = withStatus(found);
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "itinerary";
  const days = tripLengthDays(trip.startDate, trip.endDate);

  return (
    <Shell>
      <section className="pt-7">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-pine">
          <img src="/assets/back.svg" alt="" />
          My trips / {trip.title}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[36px] font-semibold leading-tight">{trip.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>{trip.destination.name}</span>
              <span aria-hidden>·</span>
              <span>
                {formatRange(trip.startDate, trip.endDate)} · {days} day{days === 1 ? "" : "s"}
              </span>
              <span aria-hidden>·</span>
              <span>Local time ({gmtLabel(trip.destination.timezone)})</span>
              <ScopeChip scope={trip.destination.scope} />
              <span className="inline-flex h-5 items-center rounded-full bg-sand px-2 text-[10px] font-semibold uppercase tracking-wide text-gold">
                {STATUS_LABEL[trip.status]}
              </span>
            </p>
          </div>
          <TripActions tripId={trip.id} archived={trip.archived} />
        </div>

        <nav aria-label="Trip sections" className="mt-7 flex gap-2 border-b border-line-soft">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/trips/${trip.id}?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={clsx(
                "-mb-px flex items-center gap-2.5 border-b-2 px-4 pb-3 pt-2 text-[15px] font-semibold transition-colors",
                tab === t.id ? "border-pine text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl", tab === t.id ? "bg-mint" : "bg-[#f6f8f6]")}>
                <img src={t.icon} alt="" className="h-5 w-5" />
              </span>
              {t.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="py-8">
        {tab === "itinerary" ? (
          <ItineraryView trip={trip} initialEvents={await listEvents(trip.id)} initialSummary={await getSummary(trip.id)} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">The {tab} agent arrives in Phase 4.</div>
        )}
      </div>
    </Shell>
  );
}
