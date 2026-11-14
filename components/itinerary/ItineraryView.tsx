"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { KIND_LABEL, overlaps, type EventKind } from "@/lib/events";
import type { ItinerarySummary, Trip, TripEvent } from "@/lib/types";
import { api } from "@/components/ui/fetcher";
import { btn } from "@/components/ui/styles";
import type { CalendarChange } from "./CalendarView";
import { EventDetails, EventForm, type EventDraft } from "./EventDrawer";
import SummaryPanel from "./SummaryPanel";

const CalendarView = dynamic(() => import("./CalendarView"), {
  ssr: false,
  loading: () => <div className="skeleton h-[680px] rounded-[14px]" />,
});

type Panel = { kind: "none" } | { kind: "view"; id: string } | { kind: "edit"; id: string } | { kind: "create"; draft: EventDraft };

const LEGEND: EventKind[] = ["sight", "activity", "food", "travel", "user"];

const PLANNING_STEPS = ["Looking up things to do", "Fitting plans around your bookings", "Balancing each day", "Writing up why"];

function PlanningOverlay({ place }: { place: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % PLANNING_STEPS.length), 2200);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/75 pt-40 backdrop-blur-[1px]" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_12px_40px_rgba(22,60,52,0.15)]">
        <img src="/assets/sparkle.svg" alt="" className="h-5 w-5 animate-spin [animation-duration:2.4s]" />
        <div>
          <p className="text-sm font-semibold">Planning your days in {place}</p>
          <p className="text-xs text-muted">{PLANNING_STEPS[i]}…</p>
        </div>
      </div>
    </div>
  );
}

export default function ItineraryView({
  trip,
  initialEvents,
  initialSummary,
}: {
  trip: Trip;
  initialEvents: TripEvent[];
  initialSummary: ItinerarySummary | null;
}) {
  const [events, setEvents] = useState<TripEvent[]>(initialEvents);
  const [summary, setSummary] = useState<ItinerarySummary | null>(initialSummary);
  const [generating, setGenerating] = useState(false);
  // Latest events for async handlers (avoids reading state inside updater functions).
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const selectedId = panel.kind === "view" || panel.kind === "edit" ? panel.id : null;
  const selected = selectedId ? events.find((e) => e.id === selectedId) ?? null : null;

  const flash = useCallback((tone: "ok" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 4000);
  }, []);

  const replace = (ev: TripEvent) => setEvents((list) => list.map((e) => (e.id === ev.id ? ev : e)));

  // Drag / resize: optimistic, revert on failure.
  const onChange = useCallback(
    async ({ id, start, end, revert }: CalendarChange) => {
      const previous = eventsRef.current.find((e) => e.id === id);
      setEvents((list) => list.map((e) => (e.id === id ? { ...e, start, end } : e)));
      try {
        const { event } = await api<{ event: TripEvent }>(`/api/events/${id}`, { method: "PATCH", json: { start, end } });
        replace(event);
      } catch (err) {
        revert();
        if (previous) replace(previous);
        flash("error", (err as Error).message);
      }
    },
    [flash],
  );

  async function save(draft: EventDraft) {
    setBusy(true);
    setFormError(null);
    try {
      if (panel.kind === "create") {
        const { event } = await api<{ event: TripEvent }>(`/api/trips/${trip.id}/events`, { method: "POST", json: draft });
        setEvents((list) => [...list, event]);
        setPanel({ kind: "view", id: event.id });
        flash("ok", "Event added");
      } else if (panel.kind === "edit") {
        const { event } = await api<{ event: TripEvent }>(`/api/events/${panel.id}`, { method: "PATCH", json: draft });
        replace(event);
        setPanel({ kind: "view", id: event.id });
        flash("ok", "Event updated");
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(ev: TripEvent) {
    const msg =
      ev.source === "booking"
        ? `"${ev.title}" comes from a confirmed booking. Removing it only hides it from the itinerary; the booking itself stays. Remove it?`
        : `Delete "${ev.title}"?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api(`/api/events/${ev.id}`, { method: "DELETE" });
      setEvents((list) => list.filter((e) => e.id !== ev.id));
      setPanel({ kind: "none" });
      flash("ok", "Event deleted");
    } catch (err) {
      flash("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate(preferences?: string) {
    setGenerating(true);
    setPanel({ kind: "none" });
    try {
      const res = await api<{ events: TripEvent[]; summary: ItinerarySummary; stats: { kept: number; moved: number } }>(
        `/api/trips/${trip.id}/itinerary/generate`,
        { method: "POST", json: preferences ? { preferences } : {} },
      );
      setEvents(res.events);
      setSummary(res.summary);
      flash("ok", `Planned ${res.stats.kept} events${res.stats.moved ? ` (${res.stats.moved} shifted to fit your schedule)` : ""}`);
    } catch (err) {
      flash("error", `Couldn't generate a plan: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function unpin(ev: TripEvent) {
    setBusy(true);
    try {
      const { event } = await api<{ event: TripEvent }>(`/api/events/${ev.id}`, { method: "PATCH", json: { pinned: false } });
      replace(event);
      flash("ok", "Unpinned: Regenerate may replace it");
    } catch (err) {
      flash("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startCreate(start?: string, end?: string) {
    setFormError(null);
    const day = trip.startDate;
    setPanel({
      kind: "create",
      draft: { title: "", start: start ?? `${day}T10:00:00`, end: end ?? `${day}T11:00:00`, category: "activity" },
    });
  }

  const counts = {
    ai: events.filter((e) => e.source === "ai").length,
    user: events.filter((e) => e.source === "user").length,
  };
  // AI events planned before a booking was made can collide with it; offer a one-click replan.
  const bookingBlocks = events.filter((e) => e.source === "booking");
  const conflicts = events.filter((e) => e.source === "ai" && bookingBlocks.some((b) => overlaps(e, b))).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h2 className="text-[21px] font-semibold">Itinerary</h2>
          {counts.ai > 0 && <span className="rounded-full bg-mint px-3 py-1 text-[10px] font-semibold text-pine">AI-suggested plan</span>}
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
            {LEGEND.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                <span className={clsx("h-2 w-2 rounded-[3px]", `legend-${k}`)} />
                {KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-3">
          {notice && (
            <span role="status" className={clsx("text-xs font-medium", notice.tone === "error" ? "text-danger" : "text-pine")}>
              {notice.text}
            </span>
          )}
          <button type="button" className={btn.soft} disabled={generating} onClick={() => generate()}>
            <img src="/assets/sparkle-regen.svg" alt="" />
            {generating ? "Planning…" : counts.ai > 0 ? "Regenerate with AI" : "Generate with AI"}
          </button>
          <button type="button" className={btn.primary} disabled={generating} onClick={() => startCreate()}>
            <img src="/assets/add-event.svg" alt="" />
            Create event
          </button>
        </div>
      </div>

      {conflicts > 0 && !generating && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand px-4 py-3 text-[13px] text-gold">
          <span>
            {conflicts} AI suggestion{conflicts === 1 ? " overlaps" : "s overlap"} your bookings. Regenerate to plan around your flights and hotel; your own events stay put.
          </span>
          <button type="button" className={btn.smallSoft} onClick={() => generate()}>
            <img src="/assets/sparkle-regen.svg" alt="" />
            Replan around bookings
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="itinerary-cal relative min-w-0 overflow-hidden rounded-[14px] border border-line bg-white">
          {generating && <PlanningOverlay place={trip.destination.name.split(",")[0]} />}
          <CalendarView
            trip={trip}
            events={events}
            selectedId={selectedId}
            onChange={onChange}
            onSelectEvent={(id) => {
              setFormError(null);
              setPanel({ kind: "view", id });
            }}
            onSelectSlot={(start, end) => startCreate(start, end)}
          />
        </div>

        <aside className="space-y-4">
          <SummaryPanel trip={trip} summary={summary} counts={counts} generating={generating} onGenerate={generate} />
          {panel.kind === "create" && (
            <EventForm key={`create-${panel.draft.start}`} trip={trip} mode="create" initial={panel.draft} onSave={save} onCancel={() => setPanel({ kind: "none" })} busy={busy} error={formError} />
          )}
          {panel.kind === "edit" && selected && (
            <EventForm key={`edit-${selected.id}`} trip={trip} mode="edit" initial={selected} lockTimes={selected.source === "booking"} onSave={save} onCancel={() => setPanel({ kind: "view", id: selected.id })} busy={busy} error={formError} />
          )}
          {panel.kind === "view" && selected && (
            <EventDetails trip={trip} event={selected} busy={busy} onEdit={() => setPanel({ kind: "edit", id: selected.id })} onDelete={() => remove(selected)} onUnpin={() => unpin(selected)} />
          )}
          {(panel.kind === "none" || (selectedId && !selected)) && (
            <div className="rounded-2xl border border-dashed border-line p-5 text-[13px] leading-5 text-muted">
              {events.length ? "Select an event to see details, edit, or delete it." : "Your calendar is empty. Click an empty slot to add your own event."}
            </div>
          )}
        </aside>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <img src="/assets/drag.svg" alt="" />
        Drag events to reschedule · Drag the bottom edge to resize · Click an empty slot to add your own
      </p>
    </div>
  );
}
