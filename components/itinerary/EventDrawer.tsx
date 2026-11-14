"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { addDays, eachDay, formatDay, hhmm } from "@/lib/dates";
import { CATEGORY_LABEL, KIND_LABEL, eventKind } from "@/lib/events";
import { EVENT_CATEGORIES, type EventCategory, type Trip, type TripEvent } from "@/lib/types";
import { btn, input, label } from "@/components/ui/styles";

export interface EventDraft {
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  category?: EventCategory;
}

const SOURCE_LABEL = { ai: "AI suggestion", user: "Your event", booking: "From a booking" } as const;

/** Read-only details for the selected event (the "Selected event" card from the design). */
export function EventDetails({
  trip,
  event,
  onEdit,
  onDelete,
  busy,
}: {
  trip: Trip;
  event: TripEvent;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const kind = eventKind(event);
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[1px] text-muted">SELECTED EVENT</p>
        {event.source !== "booking" && (
          <button type="button" onClick={onEdit} className="rounded-lg p-1 hover:bg-mint" aria-label="Edit event">
            <img src="/assets/edit.svg" alt="" />
          </button>
        )}
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-6">{event.title}</h3>
      <p className="mt-3 text-xs font-medium">{formatDay(event.start.slice(0, 10))}</p>
      <p className="mt-1 text-xs text-muted">
        {hhmm(event.start)}–{hhmm(event.end)} · {trip.destination.name.split(",")[0]} local time
      </p>
      {event.location && <p className="mt-1 text-xs text-muted">📍 {event.location}</p>}
      <p className="mt-2 text-[11px] font-medium text-pine">
        {event.source === "user" ? CATEGORY_LABEL[event.category ?? "other"] : KIND_LABEL[kind]} · {SOURCE_LABEL[event.source]}
      </p>
      {event.description && <p className="mt-3 text-[13px] leading-5 text-sage">{event.description}</p>}
      {event.source === "ai" && event.aiReason && (
        <div className="mt-3 rounded-xl bg-mist p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-pine">
            <img src="/assets/sparkle.svg" alt="" className="h-3.5 w-3.5" />
            Why I picked this
          </p>
          <p className="mt-1 text-[12.5px] leading-5 text-sage">{event.aiReason}</p>
        </div>
      )}
      <div className="mt-4 flex gap-2.5">
        {event.source !== "booking" && (
          <button type="button" className={clsx(btn.smallSoft, "rounded-[9px]")} onClick={onEdit} disabled={busy}>
            <img src="/assets/move.svg" alt="" />
            Edit
          </button>
        )}
        <button type="button" className={clsx(btn.danger, "rounded-[9px]")} onClick={onDelete} disabled={busy}>
          <img src="/assets/delete.svg" alt="" />
          Delete
        </button>
      </div>
      {event.source === "booking" && (
        <p className="mt-3 text-[11px] leading-4 text-muted">Booked times follow the booking. Cancel it from the Flights or Lodging tab.</p>
      )}
    </div>
  );
}

/** Create / edit form. */
export function EventForm({
  trip,
  initial,
  mode,
  onSave,
  onCancel,
  busy,
  error,
}: {
  trip: Trip;
  initial: EventDraft;
  mode: "create" | "edit";
  onSave: (draft: EventDraft) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const days = eachDay(trip.startDate, trip.endDate);
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.start.slice(0, 10));
  const [start, setStart] = useState(hhmm(initial.start));
  const [end, setEnd] = useState(hhmm(initial.end));
  const [location, setLocation] = useState(initial.location ?? "");
  const [category, setCategory] = useState<EventCategory>(initial.category ?? "activity");
  const [description, setDescription] = useState(initial.description ?? "");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  // "00:00" as an end time means midnight at the end of the day.
  const endsAtMidnight = end === "00:00";
  const timeError = !start || !end ? "Pick a start and end time" : !endsAtMidnight && end <= start ? "End must be after start" : null;

  return (
    <form
      className="rounded-2xl border border-line bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (timeError || !title.trim()) return;
        onSave({
          title: title.trim(),
          start: `${date}T${start}:00`,
          end: endsAtMidnight ? `${addDays(date, 1)}T00:00:00` : `${date}T${end}:00`,
          location: location.trim() || undefined,
          category,
          description: description.trim() || undefined,
        });
      }}
    >
      <p className="text-[10px] font-semibold tracking-[1px] text-muted">{mode === "create" ? "NEW EVENT" : "EDIT EVENT"}</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className={label} htmlFor="ev-title">Title</label>
          <input id="ev-title" ref={titleRef} className={input} value={title} maxLength={140} required onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner with friends" />
        </div>
        <div>
          <label className={label} htmlFor="ev-date">Day</label>
          <select id="ev-date" className={input} value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor="ev-start">Start</label>
            <input id="ev-start" type="time" step={900} className={input} value={start} required onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="ev-end">End</label>
            <input id="ev-end" type="time" step={900} className={input} value={end} required onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="ev-loc">Location</label>
          <input id="ev-loc" className={input} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className={label} htmlFor="ev-cat">Category</label>
          <select id="ev-cat" className={input} value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="ev-desc">Notes</label>
          <textarea id="ev-desc" rows={2} className={input} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      {(timeError || error) && <p className="mt-3 text-xs text-danger">{timeError ?? error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={btn.ghost} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={btn.small} disabled={busy || Boolean(timeError) || !title.trim()}>
          {busy ? "Saving…" : mode === "create" ? "Add event" : "Save"}
        </button>
      </div>
    </form>
  );
}
