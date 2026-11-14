"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { KIND_LABEL, type EventKind } from "@/lib/events";
import type { Trip, TripEvent } from "@/lib/types";
import { api } from "@/components/ui/fetcher";
import { btn } from "@/components/ui/styles";
import type { CalendarChange } from "./CalendarView";
import { EventDetails, EventForm, type EventDraft } from "./EventDrawer";

const CalendarView = dynamic(() => import("./CalendarView"), {
  ssr: false,
  loading: () => <div className="skeleton h-[680px] rounded-[14px]" />,
});

type Panel = { kind: "none" } | { kind: "view"; id: string } | { kind: "edit"; id: string } | { kind: "create"; draft: EventDraft };

const LEGEND: EventKind[] = ["sight", "activity", "food", "travel", "user"];

export default function ItineraryView({ trip, initialEvents }: { trip: Trip; initialEvents: TripEvent[] }) {
  const [events, setEvents] = useState<TripEvent[]>(initialEvents);
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
      let previous: TripEvent | undefined;
      setEvents((list) =>
        list.map((e) => {
          if (e.id !== id) return e;
          previous = e;
          return { ...e, start, end };
        }),
      );
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
          <button type="button" className={btn.primary} onClick={() => startCreate()}>
            <img src="/assets/add-event.svg" alt="" />
            Create event
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="itinerary-cal min-w-0 overflow-hidden rounded-[14px] border border-line bg-white">
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
          {panel.kind === "create" && (
            <EventForm key={`create-${panel.draft.start}`} trip={trip} mode="create" initial={panel.draft} onSave={save} onCancel={() => setPanel({ kind: "none" })} busy={busy} error={formError} />
          )}
          {panel.kind === "edit" && selected && (
            <EventForm key={`edit-${selected.id}`} trip={trip} mode="edit" initial={selected} onSave={save} onCancel={() => setPanel({ kind: "view", id: selected.id })} busy={busy} error={formError} />
          )}
          {panel.kind === "view" && selected && (
            <EventDetails trip={trip} event={selected} busy={busy} onEdit={() => setPanel({ kind: "edit", id: selected.id })} onDelete={() => remove(selected)} />
          )}
          {(panel.kind === "none" || (selectedId && !selected)) && (
            <div className="rounded-2xl border border-dashed border-line p-5 text-[13px] leading-5 text-muted">
              {events.length ? "Select an event to see details, edit, or delete it." : "Your calendar is empty. Click an empty slot to add your own event."}
            </div>
          )}
          <p className="text-[11px] text-muted">
            {counts.ai} AI suggestion{counts.ai === 1 ? "" : "s"} · {counts.user} personal event{counts.user === 1 ? "" : "s"}
          </p>
        </aside>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <img src="/assets/drag.svg" alt="" />
        Drag events to reschedule · Drag the bottom edge to resize · Click an empty slot to add your own
      </p>
    </div>
  );
}
