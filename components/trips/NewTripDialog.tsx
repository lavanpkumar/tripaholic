"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { addDays, diffDays } from "@/lib/dates";
import type { Place } from "@/lib/places";
import type { Scope } from "@/lib/types";
import { btn, input, label } from "@/components/ui/styles";

const MAX_DAYS = 30;

const SCOPES: { value: Scope; title: string; body: string }[] = [
  { value: "city", title: "City", body: "Stay in one city and go deep: neighborhoods, food, and sights close together." },
  { value: "state", title: "State", body: "Move between a few cities and regions in the state, with travel time built in." },
  { value: "country", title: "Country", body: "A multi-city route across the country, with realistic hops between stops." },
];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function season(ymd: string, lat?: number): string {
  const m = Number(ymd.slice(5, 7));
  const north = ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"][m - 1];
  if (lat === undefined || lat >= 0) return north;
  return { Winter: "Summer", Summer: "Winter", Spring: "Autumn", Autumn: "Spring" }[north]!;
}

export function suggestTitle(place: Place, startDate: string): string {
  return `${place.name} ${season(startDate, place.lat)} Trip`;
}

export default function NewTripDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [scope, setScope] = useState<Scope | null>(null);
  const today = localToday();
  const [startDate, setStartDate] = useState(addDays(today, 14));
  const [endDate, setEndDate] = useState(addDays(today, 17));
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    firstField.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced autocomplete.
  useEffect(() => {
    const q = query.trim();
    if (place || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = (await res.json()) as { places?: Place[] };
        setSuggestions(body.places ?? []);
        setActive(-1);
      } catch {
        /* aborted or offline: keep free text */
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, place]);

  // Keep the suggested title in sync until the user edits it.
  useEffect(() => {
    if (place && !titleEdited) setTitle(suggestTitle(place, startDate));
  }, [place, startDate, titleEdited]);

  function choose(p: Place) {
    setPlace(p);
    setQuery(p.label);
    setSuggestions([]);
  }

  async function continueFromLocation() {
    const q = query.trim();
    if (!q) return;
    setError(null);
    let chosen = place;
    if (!chosen) {
      setSearching(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { places?: Place[] };
        const list = body.places ?? [];
        const head = q.split(",")[0].trim().toLowerCase();
        chosen = list.find((p) => p.name.toLowerCase() === head) ?? list[0] ?? null;
      } catch {
        chosen = null;
      } finally {
        setSearching(false);
      }
      if (!chosen) {
        // Free text that no geocoder knows: keep the user's words, use their own time zone.
        chosen = { id: "free", name: q, label: q, kind: "place", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
      }
      choose(chosen);
    }
    setStep(2);
  }

  const dateError =
    !startDate || !endDate
      ? "Pick both dates"
      : endDate < startDate
        ? "End date must be on or after the start date"
        : diffDays(startDate, endDate) + 1 > MAX_DAYS
          ? `Trips can be at most ${MAX_DAYS} days`
          : null;

  async function submit() {
    if (!place || !scope || dateError || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          destination: {
            name: place.label,
            scope,
            timezone: place.timezone,
            lat: place.lat,
            lng: place.lng,
            country: place.country,
            region: place.region,
          },
          startDate,
          endDate,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create the trip");
      router.push(`/trips/${body.trip.id}?tab=flights`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 py-[8vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-trip-title" className="w-full max-w-[580px] rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(22,60,52,0.25)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">New trip · Step {step} of 3</p>
            <h2 id="new-trip-title" className="mt-2 text-[26px] font-semibold leading-tight">
              {step === 1 ? "Where are you going?" : step === 2 ? `How do you want to travel ${place?.name ?? "there"}?` : "Name it and pick dates"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={btn.ghost} aria-label="Close">
            ✕
          </button>
        </div>
        <ol className="mt-5 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((s) => (
            <li key={s} className={clsx("h-1 flex-1 rounded-full", s <= step ? "bg-pine" : "bg-mint")} />
          ))}
        </ol>

        {step === 1 && (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (active >= 0 && suggestions[active]) choose(suggestions[active]);
              else void continueFromLocation();
            }}
          >
            <label htmlFor="trip-location" className={label}>
              Location
            </label>
            <div className="relative">
              <input
                id="trip-location"
                ref={firstField}
                className={input}
                placeholder="A city, state, or country — e.g. Tokyo"
                autoComplete="off"
                required
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPlace(null);
                }}
                onKeyDown={(e) => {
                  if (!suggestions.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(suggestions.length - 1, a + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(-1, a - 1));
                  }
                }}
              />
              {suggestions.length > 0 && (
                <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_32px_rgba(22,60,52,0.12)]">
                  {suggestions.map((p, i) => (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(p);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={clsx("flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm", i === active && "bg-mist")}
                    >
                      <span className="truncate">{p.label}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">{p.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-2 h-4 text-xs text-muted">
              {place ? (
                <>
                  Selected <strong className="text-ink">{place.label}</strong> · {place.timezone}
                </>
              ) : searching ? (
                "Looking up places…"
              ) : (
                "Pick a suggestion, or keep typing and press Next."
              )}
            </p>
            <div className="mt-6 flex justify-end">
              <button type="submit" className={btn.primary} disabled={!query.trim() || searching}>
                Next
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (scope) setStep(3);
            }}
          >
            <fieldset>
              <legend className={label}>Trip scope (required)</legend>
              <div className="mt-1 grid gap-3">
                {SCOPES.map((s, i) => {
                  const suggested = place?.kind === s.value;
                  return (
                    <label
                      key={s.value}
                      className={clsx(
                        "flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors",
                        scope === s.value ? "border-pine bg-mist" : "border-line hover:border-[#c9dccf]",
                      )}
                    >
                      <input
                        ref={i === 0 ? firstField : undefined}
                        type="radio"
                        name="scope"
                        value={s.value}
                        checked={scope === s.value}
                        onChange={() => setScope(s.value)}
                        className="mt-1 accent-pine"
                      />
                      <span>
                        <span className="flex items-center gap-2 font-semibold">
                          {s.title}
                          {suggested && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold uppercase text-pine">Matches {place?.name}</span>}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5 text-muted">{s.body}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="mt-6 flex justify-between">
              <button type="button" className={btn.soft} onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className={btn.primary} disabled={!scope}>
                Next
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="trip-title" className={label}>
                Trip title
              </label>
              <input
                id="trip-title"
                ref={firstField}
                className={input}
                value={title}
                maxLength={120}
                required
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleEdited(true);
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="trip-start" className={label}>
                  Start date
                </label>
                <input
                  id="trip-start"
                  type="date"
                  className={input}
                  value={startDate}
                  required
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    if (v && endDate && endDate < v) setEndDate(v);
                  }}
                />
              </div>
              <div>
                <label htmlFor="trip-end" className={label}>
                  End date
                </label>
                <input id="trip-end" type="date" className={input} value={endDate} min={startDate} required onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <p className={clsx("text-xs", dateError ? "text-danger" : "text-muted")}>
              {dateError ??
                `${diffDays(startDate, endDate) + 1} days in ${place?.label} · ${scope} trip · times shown in ${place?.timezone}`}
            </p>
            {error && <p className="rounded-xl bg-[#fbf4f2] px-3.5 py-2.5 text-sm text-danger">{error}</p>}
            <div className="flex justify-between">
              <button type="button" className={btn.soft} onClick={() => setStep(2)}>
                Back
              </button>
              <button type="submit" className={btn.primary} disabled={busy || Boolean(dateError) || !title.trim()}>
                {busy ? "Creating…" : "Create trip"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
