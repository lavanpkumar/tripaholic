"use client";

import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useMemo } from "react";
import { addDays, tripLengthDays } from "@/lib/dates";
import { crossesMidnight, eventKind } from "@/lib/events";
import type { Trip, TripEvent } from "@/lib/types";

/**
 * Google Calendar-style time grid limited to the trip dates. The calendar runs in UTC mode so our
 * floating local times ("2027-02-08T09:00:00") display exactly as stored, in destination time.
 */

export interface CalendarChange {
  id: string;
  start: string;
  end: string;
  revert: () => void;
}

/** Date from FullCalendar (UTC mode) back to a floating local ISO string. */
export function toFloating(d: Date): string {
  return d.toISOString().slice(0, 19);
}

function hourFloor(events: TripEvent[], fallback: number): number {
  let min = fallback;
  for (const e of events) min = Math.min(min, Number(e.start.slice(11, 13)));
  return min;
}

/** Full start–end for every segment, so both halves of a night out read "22:30–02:00 +1". */
function timeLabel(arg: EventContentArg): string {
  const { start, end } = arg.event;
  if (!start || !end) return arg.timeText;
  const s = toFloating(start);
  const e = toFloating(end);
  const nextDay = crossesMidnight({ start: s, end: e });
  return `${s.slice(11, 16)}–${e.slice(11, 16)}${nextDay ? " +1" : ""}`;
}

function renderEvent(arg: EventContentArg) {
  const source = arg.event.extendedProps.source as TripEvent["source"];
  return (
    <div className="flex h-full flex-col overflow-hidden px-1.5 py-1">
      <p className="text-[10px] font-medium opacity-90">{timeLabel(arg)}</p>
      <p className="mt-0.5 text-[11.5px] font-semibold leading-[1.25]">
        {source === "ai" && <img src="/assets/sparkle.svg" alt="AI suggestion" className="mr-1 inline h-3 w-3 align-[-1px]" />}
        {arg.event.extendedProps.pinned && <span aria-label="Pinned" className="mr-1">📌</span>}
        {source === "booking" && <span aria-label="Booking" className="mr-1">✈︎</span>}
        {arg.event.title}
      </p>
    </div>
  );
}

export default function CalendarView({
  trip,
  events,
  selectedId,
  onSelectSlot,
  onSelectEvent,
  onChange,
}: {
  trip: Trip;
  events: TripEvent[];
  selectedId: string | null;
  onSelectSlot: (start: string, end: string) => void;
  onSelectEvent: (id: string) => void;
  onChange: (change: CalendarChange) => void;
}) {
  const days = tripLengthDays(trip.startDate, trip.endDate);
  const afterTrip = addDays(trip.endDate, 1);
  const lastStart = `${afterTrip}T00:00:00`;
  // A last night out that runs past midnight spills into the morning after the trip: show that column.
  const spill = events.some((e) => e.end > lastStart);
  const shownDays = days + (spill ? 1 : 0);
  const visibleDays = Math.min(shownDays, 7);
  // Nights past midnight continue at the top of the next day's column, so start the grid at 00:00.
  const minHour = events.some(crossesMidnight) ? 0 : Math.min(7, hourFloor(events, 7));

  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        editable: e.source !== "booking",
        classNames: [`cat-${eventKind(e)}`, e.id === selectedId ? "is-selected" : ""],
        extendedProps: { source: e.source, pinned: Boolean(e.pinned) },
      })),
    [events, selectedId],
  );

  const change = (arg: EventDropArg | EventResizeDoneArg) => {
    const { event } = arg;
    if (!event.start || !event.end) return arg.revert();
    onChange({ id: event.id, start: toFloating(event.start), end: toFloating(event.end), revert: arg.revert });
  };

  return (
    <FullCalendar
      plugins={[timeGridPlugin, interactionPlugin]}
      timeZone="UTC"
      initialView="tripRange"
      views={{
        tripRange: { type: "timeGrid", duration: { days: visibleDays }, buttonText: days > 7 ? "Week" : "Full trip" },
        timeGridDay: { buttonText: "Day" },
      }}
      initialDate={trip.startDate}
      validRange={{ start: trip.startDate, end: addDays(afterTrip, spill ? 1 : 0) }}
      headerToolbar={{ left: shownDays > visibleDays ? "prev,next" : "", center: "title", right: "tripRange,timeGridDay" }}
      dayHeaderClassNames={(arg) => (toFloating(arg.date) >= lastStart ? ["after-trip"] : [])}
      dayCellClassNames={(arg) => (toFloating(arg.date) >= lastStart ? ["after-trip"] : [])}
      selectAllow={(span) => toFloating(span.start) < lastStart}
      eventAllow={(span) => toFloating(span.start) < lastStart}
      titleFormat={{ month: "short", day: "numeric", year: "numeric" }}
      dayHeaderFormat={{ weekday: "short", day: "numeric" }}
      slotMinTime={`${String(minHour).padStart(2, "0")}:00:00`}
      slotMaxTime="24:00:00"
      scrollTime="08:00:00"
      slotDuration="00:30:00"
      slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      allDaySlot={false}
      nowIndicator={false}
      height={680}
      expandRows
      editable
      selectable
      selectMirror
      eventOverlap
      snapDuration="00:15:00"
      events={fcEvents}
      eventContent={renderEvent}
      eventDrop={change}
      eventResize={change}
      select={(arg: DateSelectArg) => {
        onSelectSlot(toFloating(arg.start), toFloating(arg.end));
        arg.view.calendar.unselect();
      }}
      eventClick={(arg: EventClickArg) => onSelectEvent(arg.event.id)}
    />
  );
}
