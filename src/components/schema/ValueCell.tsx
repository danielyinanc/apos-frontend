'use client';

import { formatUnit } from '@/lib/format/units';

export function ValueCell({ value, unit }: { value: number | null; unit: string | null }) {
  if (value === null || unit === null) {
    return <span className="text-fg-muted">&mdash;</span>;
  }
  const formatted = formatUnit(value, unit);
  return (
    <span className="inline-flex items-center gap-1">
      <span>{formatted.display}</span>
      {!formatted.unitKnown && (
        <span
          title={`This pack reports a unit this build doesn't recognize ("${unit}"). Value shown unformatted.`}
          className="rounded border border-[var(--color-border)] px-1 text-[10px] text-[var(--color-fg-muted)]"
        >
          {unit}
        </span>
      )}
    </span>
  );
}
