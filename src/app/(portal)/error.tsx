"use client";

import Link from "next/link";
import { useEffect } from "react";

/** A failed page keeps the shell, so there's always somewhere to go. Retry first: most failures are a slow query. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Portal page failed:", error);
  }, [error]);
  return (
    <div>
      <h1 className="text-3xl">This page didn&apos;t load</h1>
      <p className="mt-1 mb-5 text-sm text-muted">Nothing has been lost. Try again first; if it keeps happening, the reference below identifies it in the logs.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={reset}>Try again</button>
        <Link className="btn-ghost" href="/">Home</Link>
        <Link className="btn-ghost" href="/coaches">Coaches</Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-muted">Reference {error.digest}</p>}
    </div>
  );
}
