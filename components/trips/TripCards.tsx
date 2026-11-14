import Link from "next/link";
import { dayOfMonth, diffDays, formatRange, monthAbbr, todayIn, tripLengthDays } from "@/lib/dates";
import type { Scope, TripWithStatus } from "@/lib/types";

export const SCOPE_LABEL: Record<Scope, string> = { city: "City trip", state: "State trip", country: "Country trip" };

export function ScopeChip({ scope, className = "" }: { scope: Scope; className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-full bg-mint px-2 text-[10px] font-semibold uppercase tracking-wide text-pine ${className}`}>
      {SCOPE_LABEL[scope]}
    </span>
  );
}

function days(t: TripWithStatus) {
  const n = tripLengthDays(t.startDate, t.endDate);
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function PlannedTripCard({ trip }: { trip: TripWithStatus }) {
  const until = diffDays(todayIn(trip.destination.timezone), trip.startDate);
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_rgba(22,60,52,0.08)]"
    >
      <div className="flex h-[70px] w-[58px] shrink-0 flex-col justify-center rounded-xl bg-mint pl-3.5">
        <span className="text-[10px] font-semibold text-pine">{monthAbbr(trip.startDate)}</span>
        <strong className="text-2xl font-medium leading-tight">{dayOfMonth(trip.startDate)}</strong>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-semibold leading-snug">{trip.title}</h3>
        <p className="mt-1 text-sm text-muted">{formatRange(trip.startDate, trip.endDate)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {days(trip)} · {until === 1 ? "tomorrow" : `in ${until} days`}
          <ScopeChip scope={trip.destination.scope} />
        </p>
      </div>
      <img src="/assets/chevron.svg" alt="" className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function LiveTripCard({ trip }: { trip: TripWithStatus }) {
  const total = tripLengthDays(trip.startDate, trip.endDate);
  const day = Math.min(total, diffDays(trip.startDate, todayIn(trip.destination.timezone)) + 1);
  return (
    <Link href={`/trips/${trip.id}`} className="group block rounded-2xl bg-mist p-5 transition-shadow hover:shadow-[0_6px_24px_rgba(22,60,52,0.08)]">
      <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] text-pine">
        <img src="/assets/live-dot.svg" alt="" />
        HAPPENING NOW
      </p>
      <h3 className="mt-3 text-[23px] font-semibold leading-tight">{trip.title}</h3>
      <p className="mt-2 text-sm text-muted">{formatRange(trip.startDate, trip.endDate)}</p>
      <div className="mt-8 flex items-center justify-between">
        <p className="text-[13px] font-medium text-pine">
          Day {day} of {total}
        </p>
        <span className="flex items-center gap-2 text-sm font-semibold text-pine">
          View trip <img src="/assets/arrow.svg" alt="" className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="mt-3 h-1 rounded-full bg-[#d8e7db]" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={day}>
        <div className="h-1 rounded-full bg-pine" style={{ width: `${(day / total) * 100}%` }} />
      </div>
    </Link>
  );
}

export function ArchivedTripCard({ trip }: { trip: TripWithStatus }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_rgba(22,60,52,0.08)]"
    >
      <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl bg-sand">
        <img src="/assets/sunset.svg" alt="" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-semibold leading-snug">{trip.title}</h3>
        <p className="mt-1.5 text-[13px] text-muted">
          {formatRange(trip.startDate, trip.endDate)} · {days(trip)}
        </p>
        <p className="mt-2 text-xs text-muted">{trip.archived ? "Archived by you" : "A little sunshine, saved."}</p>
      </div>
      <img src="/assets/chevron.svg" alt="" className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function EmptyColumn({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[13px] text-muted">{text}</div>;
}
