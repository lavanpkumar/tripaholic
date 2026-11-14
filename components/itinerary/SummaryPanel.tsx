"use client";

import { useState } from "react";
import type { ItinerarySummary, Trip } from "@/lib/types";
import { btn } from "@/components/ui/styles";

/** "Why this plan": the AI's overall reasoning, plus a box to ask for a different plan. */
export default function SummaryPanel({
  trip,
  summary,
  counts,
  generating,
  onGenerate,
}: {
  trip: Trip;
  summary: ItinerarySummary | null;
  counts: { ai: number; user: number };
  generating: boolean;
  onGenerate: (preferences?: string) => void;
}) {
  const [ask, setAsk] = useState("");
  const [expanded, setExpanded] = useState(false);
  const place = trip.destination.name.split(",")[0];

  if (!summary) {
    return (
      <div className="rounded-2xl bg-mist p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <img src="/assets/sparkle-plan.svg" alt="" />
          Let AI plan your days
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-sage">
          Gemini picks things to do in {place}, fits them around your bookings and your own events, and explains every choice. You can move, delete, or add anything
          afterwards.
        </p>
        <button type="button" className={`${btn.primary} mt-4 w-full`} disabled={generating} onClick={() => onGenerate()}>
          <img src="/assets/sparkle-white.svg" alt="" />
          {generating ? "Planning…" : "Generate with AI"}
        </button>
      </div>
    );
  }

  const long = summary.summary.length > 280;
  return (
    <div className="rounded-2xl bg-mist p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <img src="/assets/sparkle-plan.svg" alt="" />
          Why this plan
        </h2>
        <span className="mt-1 shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-pine">{summary.mode === "gemini" ? "Gemini" : "Offline planner"}</span>
      </div>
      <p className="mt-1.5 text-[11px] text-sage">
        {counts.ai} AI suggestion{counts.ai === 1 ? "" : "s"} · {counts.user} personal event{counts.user === 1 ? "" : "s"}
      </p>
      {summary.notice && <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-[11.5px] leading-4 text-gold">{summary.notice}</p>}
      {summary.highlights.map((h) => (
        <div key={h.title} className="mt-4">
          <h3 className="text-[13px] font-semibold">{h.title}</h3>
          <p className="mt-1 text-xs leading-[18px] text-sage">{h.body}</p>
        </div>
      ))}
      <p className="mt-4 text-xs leading-[18px] text-sage">
        {long && !expanded ? `${summary.summary.slice(0, 260).trimEnd()}…` : summary.summary}
        {long && (
          <button type="button" className="ml-1 font-semibold text-pine underline-offset-2 hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "More"}
          </button>
        )}
      </p>
      <form
        className="mt-4 flex h-9 items-center rounded-lg border border-[#d9e7dc] bg-white pl-3 pr-1 focus-within:border-pine"
        onSubmit={(e) => {
          e.preventDefault();
          onGenerate(ask.trim() || undefined);
        }}
      >
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-muted"
          placeholder="Ask AI to adjust this plan…"
          value={ask}
          maxLength={500}
          onChange={(e) => setAsk(e.target.value)}
          aria-label="Ask AI to adjust this plan"
          disabled={generating}
        />
        <button type="submit" className="rounded-md p-1.5 hover:bg-mint disabled:opacity-50" aria-label="Regenerate with this request" disabled={generating}>
          <img src="/assets/send-plan.svg" alt="" />
        </button>
      </form>
      <p className="mt-2 text-[10.5px] text-muted">Regenerating replaces AI suggestions only. Your own events and bookings stay put.</p>
    </div>
  );
}
