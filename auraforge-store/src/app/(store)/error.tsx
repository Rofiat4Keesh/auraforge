"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/** Shown when a page fails to load (for example, if the database is unreachable). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <p className="eyebrow text-neon-magenta">System fault</p>
      <h1 className="mt-4 text-2xl font-bold">Something went wrong loading this page</h1>
      <p className="mt-3 max-w-md text-ink-400">
        Please try again. If the problem continues, contact our support team.
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-8">
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
