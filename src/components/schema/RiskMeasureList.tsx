'use client';

import type { CapabilityIndex } from '@/lib/format/capability';
import type { RiskMeasures } from '@/lib/format/schemas';
import { ValueCell } from './ValueCell';

export function RiskMeasureList({ data, index }: { data: RiskMeasures; index: CapabilityIndex }) {
  type Row =
    | {
        kind: 'value';
        capability_id: string;
        value: number | null;
        unit: string | null;
        citation_id: string;
      }
    | { kind: 'degraded'; capability_id: string; reason: string };

  const rows: Row[] = [
    ...data.measures.map((m) => ({ kind: 'value' as const, ...m })),
    ...data.degraded.map((d) => ({ kind: 'degraded' as const, ...d })),
  ];

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-fg-muted)]">No risk measures published.</p>;
  }

  return (
    <ul className="flex flex-col gap-1" aria-label="Risk measures">
      {rows.map((row) => (
        <li
          key={row.capability_id}
          className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
            row.kind === 'degraded' ? 'border-l-2 border-[var(--color-caution)]' : ''
          }`}
        >
          <span title={row.capability_id}>{index.label(row.capability_id)}</span>
          {row.kind === 'value' ? (
            <span className="flex items-center gap-1">
              <ValueCell value={row.value} unit={row.unit} />
              <span
                className="text-[10px] text-[var(--color-fg-muted)]"
                title={`citation: ${row.citation_id}`}
              >
                [{row.citation_id.slice(0, 8)}]
              </span>
            </span>
          ) : (
            <span className="text-[var(--color-caution)]" title={row.reason}>
              degraded
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
