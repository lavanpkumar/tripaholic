import clsx from "clsx";
import { formatDay, hhmm } from "@/lib/dates";
import type { FlightOption, LodgingOption } from "@/lib/providers/types";
import type { FlightLeg } from "@/lib/types";

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const duration = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const shortDay = (iso: string) => formatDay(iso.slice(0, 10)).replace(/ \d{4}$/, "");

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "gold" }) {
  return <span className={clsx("text-[9px] font-semibold uppercase tracking-[1px]", tone === "green" ? "text-pine" : "text-gold")}>{children}</span>;
}

function Leg({ leg }: { leg: FlightLeg }) {
  return (
    <div className="grid grid-cols-[64px_auto_1fr_auto] items-center gap-3">
      <span className="text-[9px] font-semibold uppercase text-muted">{shortDay(leg.depart)}</span>
      <div>
        <p className="text-lg font-semibold leading-5">{hhmm(leg.depart)}</p>
        <p className="text-[10px] text-muted">{leg.from}</p>
      </div>
      <div className="px-1 text-center">
        <p className="text-[10px] font-medium text-muted">
          {duration(leg.durationMinutes)} · {leg.stops === 0 ? "Nonstop" : `${leg.stops} stop${leg.stops > 1 ? "s" : ""}${leg.via ? ` (${leg.via})` : ""}`}
        </p>
        <div className="mt-1 h-px bg-[#b8cec1]" />
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold leading-5">
          {hhmm(leg.arrive)}
          {leg.arrive.slice(0, 10) !== leg.depart.slice(0, 10) && <sup className="ml-0.5 text-[9px] text-gold">+{Math.round((Date.parse(leg.arrive.slice(0, 10)) - Date.parse(leg.depart.slice(0, 10))) / 86_400_000)}</sup>}
        </p>
        <p className="text-[10px] text-muted">{leg.to}</p>
      </div>
    </div>
  );
}

export function FlightCard({
  option,
  picked,
  children,
}: {
  option: Pick<FlightOption, "airline" | "price" | "outbound" | "inbound" | "baggage" | "cabin"> & { tags?: string[] };
  picked?: boolean;
  children?: React.ReactNode;
}) {
  const tags = option.tags ?? [];
  return (
    <article className={clsx("rounded-2xl border bg-white p-4 sm:p-5", picked ? "border-pine shadow-[0_0_0_1px_var(--color-pine)]" : "border-line")}>
      <div className="grid gap-4 md:grid-cols-[1fr_1px_150px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {picked && <Badge>AI top pick</Badge>}
            {tags.filter((t) => t === "Cheapest" || t === "Fastest" || t === "Red-eye").map((t) => (
              <Badge key={t} tone={t === "Red-eye" ? "gold" : "green"}>
                {t}
              </Badge>
            ))}
          </div>
          <h3 className="mt-1 text-[17px] font-semibold">{option.airline}</h3>
          <p className="text-[11px] text-muted">
            <span className="capitalize">{option.cabin}</span> · {option.inbound ? "Round trip" : "One way"} · {option.baggage}
          </p>
          <div className="mt-3 space-y-2.5">
            <Leg leg={option.outbound} />
            {option.inbound && <Leg leg={option.inbound} />}
          </div>
        </div>
        <div className="hidden bg-line-soft md:block" />
        <div className="flex flex-row items-end justify-between gap-2 md:flex-col md:items-start md:justify-center">
          <div>
            <p className="text-[26px] font-semibold leading-8">{money(option.price)}</p>
            <p className="text-[11px] text-muted">total, taxes incl.</p>
          </div>
          {children}
        </div>
      </div>
    </article>
  );
}

export function StayCard({
  option,
  picked,
  children,
}: {
  option: Pick<LodgingOption, "name" | "type" | "neighborhood" | "rating" | "nightlyPrice" | "nights"> &
    Partial<Pick<LodgingOption, "photo" | "amenities" | "reviews" | "totalPrice" | "cancellation" | "distanceKm" | "tags">>;
  picked?: boolean;
  children?: React.ReactNode;
}) {
  const total = option.totalPrice ?? option.nightlyPrice * option.nights;
  return (
    <article className={clsx("flex flex-col gap-4 rounded-2xl border bg-white p-3 sm:flex-row", picked ? "border-pine shadow-[0_0_0_1px_var(--color-pine)]" : "border-line")}>
      <img src={option.photo ?? "/assets/palm-grove.png"} alt="" className="h-36 w-full shrink-0 rounded-[10px] object-cover sm:h-[122px] sm:w-[180px]" />
      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {picked && <Badge>AI top pick</Badge>}
          <Badge tone={option.type === "airbnb" ? "gold" : "green"}>{option.type === "airbnb" ? "Airbnb-style · entire home" : "Hotel"}</Badge>
          {(option.tags ?? []).filter((t) => t !== "Entire home").map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        <h3 className="mt-1 truncate text-lg font-semibold">{option.name}</h3>
        <p className="text-xs text-muted">
          {option.neighborhood}
          {option.distanceKm !== undefined && ` · ${option.distanceKm} km from the center`}
        </p>
        {option.amenities && <p className="mt-1.5 text-[11px] text-muted">{option.amenities.slice(0, 5).join(" · ")}</p>}
        {option.cancellation && <p className="mt-1.5 text-[10px] font-medium text-pine">{option.cancellation}</p>}
      </div>
      <div className="flex shrink-0 flex-row items-end justify-between gap-2 px-1 pb-1 sm:w-[150px] sm:flex-col sm:items-start sm:justify-center">
        <div>
          <p className="text-[11px] font-medium text-sage">
            ★ {option.rating.toFixed(1)}
            {option.reviews !== undefined && ` (${option.reviews})`}
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-8">{money(option.nightlyPrice)}</p>
          <p className="text-[11px] text-muted">per night</p>
          <p className="mt-1 text-[11px] font-medium">
            {money(total)} · {option.nights} night{option.nights === 1 ? "" : "s"}
          </p>
        </div>
        {children}
      </div>
    </article>
  );
}
