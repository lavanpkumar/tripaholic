"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Proposal } from "@/lib/ai/agent-tools";
import type { FlightOption, LodgingOption } from "@/lib/providers/types";
import type { AgentFinal, AgentKind, AgentRun, AgentStep, Booking, FlightBookingDetails, LodgingBookingDetails, Trip } from "@/lib/types";
import { api } from "@/components/ui/fetcher";
import { btn } from "@/components/ui/styles";
import AgentLog from "./AgentLog";
import { FlightCard, StayCard, money } from "./OptionCards";

const EXAMPLES: Record<AgentKind, string[]> = {
  flight: ["Cheapest direct flight from JFK, arriving before noon", "Fastest flight from San Francisco for 2 adults", "From London, no red-eyes, leave after 9am"],
  lodging: ["Best rated hotel near the center with breakfast", "Cheapest Airbnb with a kitchen for 2 guests", "Hotel with a pool under $200 a night"],
};

const COPY = {
  flight: { title: "Find your way there", lede: "Tell the agent what matters. It searches, compares, explains its pick, and books it.", placeholder: "e.g. cheapest direct flight from JFK, arriving before noon", empty: "Choose your flight", icon: "/assets/choose-flight.svg", booked: "Your flights" },
  lodging: { title: "Find your stay", lede: "Hotels and Airbnb-style homes, compared for you and booked in one go.", placeholder: "e.g. best rated hotel near the center with breakfast", empty: "Choose your stay", icon: "/assets/choose-stay.svg", booked: "Your stay" },
};

/** Parse a fetch() SSE body into events. */
async function* readSse(res: Response): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = block.match(/^event: (.*)$/m)?.[1] ?? "message";
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (data) yield { event, data: JSON.parse(data) };
    }
  }
}

function bookedOptionId(b: Booking): string {
  return b.details.kind === "flight" ? (b.details as FlightBookingDetails).optionId : (b.details as LodgingBookingDetails).propertyId;
}

export default function AgentPanel({
  trip,
  kind,
  initialBookings,
  initialRun,
}: {
  trip: Trip;
  kind: AgentKind;
  initialBookings: Booking[];
  initialRun: AgentRun | null;
}) {
  const router = useRouter();
  const copy = COPY[kind];
  const [request, setRequest] = useState("");
  const [autoBook, setAutoBook] = useState(initialRun?.autoBook ?? true);
  const [steps, setSteps] = useState<AgentStep[]>(initialRun?.steps ?? []);
  const [runId, setRunId] = useState<string | null>(initialRun?.id ?? null);
  const [mode, setMode] = useState<"gemini" | "offline" | undefined>(initialRun?.mode);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [error, setError] = useState<string | null>(null);
  // For "Show me another option": the request being answered and the picks already passed on.
  const [lastRequest, setLastRequest] = useState(initialRun?.userRequest ?? "");
  const [excluded, setExcluded] = useState<string[]>([]);

  const final = useMemo(() => [...steps].reverse().find((s) => s.type === "final")?.content as AgentFinal | undefined, [steps]);
  const proposal = final?.status === "awaiting_confirmation" ? (final.proposal as Proposal | undefined) : undefined;
  const options = useMemo(() => {
    const r = [...steps].reverse().find((s) => s.type === "tool_result" && Array.isArray((s.content as { options?: unknown[] }).options));
    return ((r?.content as { options?: (FlightOption | LodgingOption)[] })?.options ?? []) as (FlightOption | LodgingOption)[];
  }, [steps]);
  const pickedId = proposal?.optionId ?? (final?.booking ? bookedOptionId(final.booking) : undefined);

  const addBooking = (b?: Booking) => {
    if (b) setBookings((list) => (list.some((x) => x.id === b.id) ? list : [...list, b]));
  };

  async function run(text: string, exclude: string[] = []) {
    const req = text.trim();
    if (req.length < 3 || running) return;
    setRunning(true);
    setError(null);
    setSteps([]);
    setLastRequest(req);
    setExcluded(exclude);
    try {
      const res = await fetch(`/api/trips/${trip.id}/agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, request: req, autoBook, exclude }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      for await (const { event, data } of readSse(res)) {
        if (event === "run") {
          const d = data as { runId: string; mode: "gemini" | "offline" };
          setRunId(d.runId);
          setMode(d.mode);
        } else if (event === "step") {
          const s = data as AgentStep;
          setSteps((list) => [...list, s]);
          if (s.type === "tool_result") addBooking((s.content as { booking?: Booking }).booking);
          if (s.type === "thought" && /offline agent/.test(String((s.content as { text?: string }).text))) setMode("offline");
        }
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function confirm() {
    if (!proposal || !runId) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await api<{ booking: Booking; steps: AgentStep[] }>(`/api/trips/${trip.id}/bookings/confirm`, { method: "POST", json: { runId, optionId: proposal.optionId } });
      setSteps((list) => [...list, ...res.steps]);
      addBooking(res.booking);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  async function cancel(b: Booking) {
    if (!window.confirm(`Cancel this ${b.type === "flight" ? "flight" : "stay"} (confirmation ${b.confirmationCode})? Its blocks are removed from the itinerary too.`)) return;
    try {
      await api(`/api/bookings/${b.id}`, { method: "DELETE" });
      setBookings((list) => list.filter((x) => x.id !== b.id));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_392px]">
      <div className="min-w-0 space-y-6">
        <form
          className="rounded-2xl border border-line bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run(request);
          }}
        >
          <h2 className="text-[21px] font-semibold">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted">{copy.lede}</p>
          <label htmlFor={`agent-${kind}`} className="sr-only">
            Request for the agent
          </label>
          <textarea
            id={`agent-${kind}`}
            rows={2}
            maxLength={1000}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void run(request);
              }
            }}
            placeholder={copy.placeholder}
            className="mt-4 w-full resize-none rounded-xl border border-line px-3.5 py-3 text-[15px] placeholder:text-[#9aa8a2] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/15"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES[kind].map((ex) => (
              <button key={ex} type="button" className="rounded-full bg-mint px-3 py-1 text-[11.5px] font-medium text-pine hover:bg-[#e1eee6]" onClick={() => setRequest(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
              <button
                type="button"
                role="switch"
                aria-checked={autoBook}
                onClick={() => setAutoBook((v) => !v)}
                className={clsx("relative h-6 w-11 rounded-full transition-colors", autoBook ? "bg-pine" : "bg-[#cfd9d3]")}
              >
                <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", autoBook ? "left-[22px]" : "left-0.5")} />
              </button>
              Let the agent book automatically
              <span className="text-[11px] text-muted">{autoBook ? "(it books its pick)" : "(you confirm first)"}</span>
            </label>
            <button type="submit" className={`${btn.primary} rounded-xl px-6`} disabled={running || request.trim().length < 3}>
              <img src="/assets/sparkle-white.svg" alt="" />
              {running ? "Working…" : "Search with AI"}
            </button>
          </div>
          {error && <p className="mt-3 rounded-xl bg-[#fbf4f2] px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        </form>

        {bookings.length > 0 && (
          <section aria-label={copy.booked}>
            <h2 className="mb-3 text-[19px] font-semibold">{copy.booked}</h2>
            <div className="space-y-3">
              {bookings.map((b) => {
                const actions = (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-pine">✓ Confirmed · {b.confirmationCode}</p>
                    <p className="text-[10.5px] text-muted">Booked by {b.bookedBy === "agent" ? "the agent" : "you"} · demo</p>
                    <button type="button" className="text-[11px] font-semibold text-danger hover:underline" onClick={() => cancel(b)}>
                      Cancel booking
                    </button>
                  </div>
                );
                if (b.details.kind === "flight") {
                  const d = b.details as FlightBookingDetails;
                  return (
                    <FlightCard key={b.id} option={{ airline: d.airline, cabin: d.cabin, price: b.priceTotal, outbound: d.outbound, inbound: d.inbound, baggage: `${d.passengers} passenger${d.passengers > 1 ? "s" : ""}` }}>
                      {actions}
                    </FlightCard>
                  );
                }
                const d = b.details as LodgingBookingDetails;
                return (
                  <StayCard key={b.id} option={{ name: d.name, type: d.type, neighborhood: `${d.neighborhood} · ${d.checkIn} → ${d.checkOut}`, rating: d.rating, nightlyPrice: d.nightlyPrice, nights: d.nights, totalPrice: b.priceTotal }}>
                    {actions}
                  </StayCard>
                );
              })}
            </div>
            <Link href={`/trips/${trip.id}?tab=itinerary`} className="mt-3 inline-flex text-[13px] font-semibold text-pine hover:underline">
              See it on the itinerary →
            </Link>
          </section>
        )}

        <section aria-label="Options the agent compared">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[19px] font-semibold">{kind === "flight" ? "Flights the agent compared" : "Stays the agent compared"}</h2>
            {options.length > 0 && <p className="text-xs text-muted">{options.length} options · demo data</p>}
          </div>
          {running && options.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[130px] rounded-2xl" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center">
              <img src={copy.icon} alt="" className="mx-auto" />
              <h3 className="mt-4 text-xl font-semibold">{copy.empty}</h3>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-muted">Ask the agent above. The options it compares appear here, with its pick highlighted.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...options].sort((a, b) => Number(b.id === pickedId) - Number(a.id === pickedId)).map((o) =>
                "outbound" in o ? (
                  <FlightCard key={o.id} option={o} picked={o.id === pickedId} />
                ) : (
                  <StayCard key={o.id} option={o} picked={o.id === pickedId} />
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <p className="text-[10px] font-semibold tracking-[1px] text-muted">YOUR TRAVEL ASSISTANT</p>
        <AgentLog steps={steps} running={running} mode={mode} />
        {proposal && (
          <div className="rounded-2xl border-2 border-pine bg-white p-5">
            <p className="text-[10px] font-semibold tracking-[1px] text-pine">CONFIRM BOOKING</p>
            <h3 className="mt-2 text-lg font-semibold">
              {"outbound" in proposal.option ? `${proposal.option.airline} ${proposal.option.outbound.flightNumber}` : proposal.option.name}
            </h3>
            <p className="mt-1 text-[13px] text-muted">
              {"outbound" in proposal.option ? `${money(proposal.option.price)} total` : `${money(proposal.option.totalPrice)} for ${proposal.option.nights} nights`}
            </p>
            {proposal.rationale && <p className="mt-2 text-[12.5px] leading-[19px] text-sage">{proposal.rationale}</p>}
            <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={confirm} disabled={confirming || running}>
              {confirming ? "Booking…" : "Confirm booking"}
            </button>
            <button
              type="button"
              className={`${btn.soft} mt-2 w-full`}
              disabled={confirming || running || !lastRequest}
              onClick={() => run(lastRequest, [...excluded, proposal.optionId])}
            >
              Show me another option
            </button>
            <p className="mt-2 text-center text-[10.5px] text-muted">Demo booking · nothing is charged</p>
          </div>
        )}
      </aside>
    </div>
  );
}
