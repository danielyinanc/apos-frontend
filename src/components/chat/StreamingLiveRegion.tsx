'use client';

import { useEffect, useState } from 'react';

/**
 * Screen readers re-announce on every aria-live mutation, so token deltas
 * must never be piped in directly. This buffers a status line and flushes
 * on a fixed cadence -- not on every render.
 */
export function StreamingLiveRegion({ status }: { status: string }) {
  const [announced, setAnnounced] = useState(status);
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(status), 1200);
    return () => clearTimeout(t);
  }, [status]);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announced}
    </div>
  );
}
