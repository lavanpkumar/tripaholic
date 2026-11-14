"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "@/components/ui/styles";

/** Archive / unarchive / delete for the trip header. */
export default function TripActions({ tripId, archived }: { tripId: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      if (method === "DELETE") router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <button type="button" className={btn.smallSoft} disabled={busy} onClick={() => call("PATCH", { archived: !archived })}>
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button
        type="button"
        className={btn.danger}
        disabled={busy}
        onClick={() => {
          if (window.confirm("Delete this trip, its itinerary, and its bookings? This cannot be undone.")) void call("DELETE");
        }}
      >
        Delete
      </button>
    </div>
  );
}
