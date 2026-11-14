"use client";

import Link from "next/link";
import { useEffect } from "react";
import { btn } from "@/components/ui/styles";

/** Route-level error boundary: a friendly page with retry instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-24 text-center sm:px-8 lg:px-16">
      <img src="/assets/compass.svg" alt="" className="mx-auto h-10 w-10" />
      <p className="eyebrow mt-6">Slight detour</p>
      <h1 className="mt-3 text-[32px] font-semibold">Something went wrong loading this page</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Your trips are safe. This is usually a brief connection problem with the database or AI service.
        {error.digest && <span className="mt-2 block text-xs">Reference: {error.digest}</span>}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" className={btn.primary} onClick={reset}>
          Try again
        </button>
        <Link href="/" className={btn.soft}>
          Back to my trips
        </Link>
      </div>
    </div>
  );
}
