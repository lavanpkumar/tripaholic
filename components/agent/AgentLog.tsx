"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { AgentFinal, AgentStep } from "@/lib/types";

/** The visible agent step log: thoughts, tool calls with arguments, tool results, and the final answer. */

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  confirmedByUser?: boolean;
}
interface ToolResult {
  name: string;
  summary: string;
  error?: string;
}

function argText(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([k, v]) => k !== "rationale" && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
}

function Row({ step, index }: { step: AgentStep; index: number }) {
  const c = step.content as Record<string, unknown>;
  if (step.type === "thought") {
    return (
      <li className="step-in flex gap-2.5">
        <img src="/assets/sparkle.svg" alt="" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="text-[12.5px] leading-[19px] text-sage">{String(c.text ?? "")}</p>
      </li>
    );
  }
  if (step.type === "tool_call") {
    const call = c as unknown as ToolCall;
    const rationale = typeof call.args?.rationale === "string" ? call.args.rationale : null;
    return (
      <li className="step-in">
        <div className="rounded-lg border border-[#d9e7dc] bg-white px-2.5 py-1.5 font-mono text-[11px] leading-4 text-ink">
          <span className="font-semibold text-pine">{call.name}</span>({argText(call.args ?? {})}){call.confirmedByUser && <span className="ml-1 text-muted">· confirmed by you</span>}
        </div>
        {rationale && <p className="mt-1.5 border-l-2 border-pine/40 pl-2.5 text-[12px] italic leading-[18px] text-sage">{rationale}</p>}
      </li>
    );
  }
  if (step.type === "tool_result") {
    const r = c as unknown as ToolResult;
    return (
      <li className={clsx("step-in pl-3 text-[11.5px] font-medium", r.error ? "text-danger" : "text-pine")}>
        ↳ {r.summary}
      </li>
    );
  }
  const f = c as unknown as AgentFinal;
  return (
    <li className={clsx("step-in rounded-xl p-3 text-[12.5px] leading-[19px]", f.status === "failed" ? "bg-[#fbf4f2] text-danger" : "bg-white text-ink")} key={index}>
      <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted">
        {f.status === "booked" ? "Booked" : f.status === "awaiting_confirmation" ? "Waiting for you" : "Couldn't book"}
      </p>
      <p className="mt-1">{f.message}</p>
    </li>
  );
}

export default function AgentLog({ steps, running, mode }: { steps: AgentStep[]; running: boolean; mode?: "gemini" | "offline" }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps.length]);

  return (
    <div className="rounded-2xl bg-mist p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <img src="/assets/sparkle.svg" alt="" />
          Agent log
        </h2>
        <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-pine">
          {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pine" />}
          {running ? "Working" : mode === "gemini" ? "Gemini" : mode === "offline" ? "Offline agent" : "Ready"}
        </span>
      </div>
      {steps.length === 0 ? (
        <p className="mt-3 text-[13px] leading-5 text-sage">Every step shows up here as it happens: what the agent is thinking, each tool it calls, what comes back, and why it picks what it books.</p>
      ) : (
        <ol className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {steps.map((s, i) => (
            <Row key={i} step={s} index={i} />
          ))}
          {running && (
            <li className="flex items-center gap-2 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pine" /> thinking…
            </li>
          )}
          <li ref={end} aria-hidden />
        </ol>
      )}
    </div>
  );
}
