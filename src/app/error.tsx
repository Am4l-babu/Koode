"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

/** Friendly error boundary — never shows stack traces. `digest` is a server-side reference. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ref = error.digest ? `ERR-${error.digest.slice(0, 8).toUpperCase()}` : undefined;
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <ErrorState errorId={ref} action={<Button onClick={reset}>Try Again</Button>} />
    </div>
  );
}
