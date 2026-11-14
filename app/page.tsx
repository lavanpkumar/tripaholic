import { connection } from "next/server";
import Shell from "@/components/Shell";
import NewTripButton from "@/components/trips/NewTripButton";
import { ArchivedTripCard, EmptyColumn, LiveTripCard, PlannedTripCard } from "@/components/trips/TripCards";
import { DEMO_USER_ID } from "@/lib/env";
import { withStatus } from "@/lib/status";
import { listTrips } from "@/lib/store/repo";
import type { TripWithStatus } from "@/lib/types";

function Column({ title, count, children, note }: { title: string; count: number; children: React.ReactNode; note?: string }) {
  return (
    <section aria-label={title}>
      <header className="mb-6 flex items-center gap-3.5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="inline-flex h-6 min-w-[25px] items-center justify-center rounded-full bg-mint px-2 text-[11px] font-semibold text-pine">{count}</span>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
      {note && <p className="mt-4 max-w-[400px] text-xs text-muted">{note}</p>}
    </section>
  );
}

export default async function Home() {
  await connection();
  let trips: TripWithStatus[] = [];
  let loadError: string | null = null;
  try {
    trips = (await listTrips(DEMO_USER_ID)).map((t) => withStatus(t));
  } catch (err) {
    console.error(err);
    loadError = "We couldn't load your trips. Check the database connection and refresh.";
  }
  const planned = trips.filter((t) => t.status === "planned").sort((a, b) => a.startDate.localeCompare(b.startDate));
  const live = trips.filter((t) => t.status === "in_progress").sort((a, b) => a.startDate.localeCompare(b.startDate));
  const archived = trips.filter((t) => t.status === "archived").sort((a, b) => b.endDate.localeCompare(a.endDate));

  return (
    <Shell>
      <section className="flex flex-wrap items-end justify-between gap-6 pb-12 pt-14">
        <div>
          <p className="eyebrow">Your next chapter</p>
          <h1 className="mt-3 text-[42px] font-semibold leading-tight">My trips</h1>
          <p className="mt-3 text-base text-muted">Good plans. Great memories.</p>
        </div>
        <NewTripButton />
      </section>

      {loadError && <p className="mb-8 rounded-2xl bg-[#fbf4f2] px-5 py-4 text-sm text-danger">{loadError}</p>}

      <div className="grid gap-10 pb-20 lg:grid-cols-3 lg:gap-8">
        <Column title="Planned Trips" count={planned.length}>
          {planned.length ? planned.map((t) => <PlannedTripCard key={t.id} trip={t} />) : <EmptyColumn text="No upcoming trips yet. Start one with New Trip." />}
        </Column>
        <Column title="In-progress Trips" count={live.length} note="Trips move here automatically on their start date.">
          {live.length ? live.map((t) => <LiveTripCard key={t.id} trip={t} />) : <EmptyColumn text="Nothing underway right now." />}
        </Column>
        <Column title="Archived Trips" count={archived.length} note="Finished trips land here, along with any you archive.">
          {archived.length ? archived.map((t) => <ArchivedTripCard key={t.id} trip={t} />) : <EmptyColumn text="Past trips will collect here." />}
        </Column>
      </div>
    </Shell>
  );
}
