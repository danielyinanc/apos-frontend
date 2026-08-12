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
    | { kind: 'degraded'; capability_id: string; reason: string }
    | { kind: 'unavailable'; capability_id: string; status: string; reason: string | null };

  // The risk/measures endpoint's `degraded[]` is authoritative when it says
  // something -- descriptor status only fills in a risk_measure capability
  // the endpoint omitted ENTIRELY (never returned in `measures` or
  // `degraded`), so the row still shows an explicit marker instead of
  // silently vanishing. Never a blank cell, never a stale prior value.
  const covered = new Set([
    ...data.measures.map((m) => m.capability_id),
    ...data.degraded.map((d) => d.capability_id),
  ]);
  const uncoveredUnavailable = index
    .byKind('risk_measure')
    .filter((c) => !covered.has(c.capability_id) && c.status && c.status.status !== 'available');

  const rows: Row[] = [
    ...data.measures.map((m) => ({ kind: 'value' as const, ...m })),
    ...data.degraded.map((d) => ({ kind: 'degraded' as const, ...d })),
    ...uncoveredUnavailable.map((c) => ({
      kind: 'unavailable' as const,
      capability_id: c.capability_id,
      status: c.status?.status ?? 'unavailable',
      reason: c.status?.reason ?? null,
    })),
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
          } ${row.kind === 'unavailable' && row.status === 'unavailable' ? 'border-l-2 border-[var(--color-negative)]' : ''} ${
            row.kind === 'unavailable' && row.status !== 'unavailable'
              ? 'border-l-2 border-[var(--color-caution)]'
              : ''
          }`}
        >
          <span title={row.capability_id}>{index.label(row.capability_id)}</span>
          {row.kind === 'value' && (
            <span className="flex items-center gap-1">
              <ValueCell value={row.value} unit={row.unit} />
              <span
                className="text-[10px] text-[var(--color-fg-muted)]"
                title={`citation: ${row.citation_id}`}
              >
                [{row.citation_id.slice(0, 8)}]
              </span>
            </span>
          )}
          {row.kind === 'degraded' && (
            <span className="text-[var(--color-caution)]" title={row.reason}>
              degraded
            </span>
          )}
          {row.kind === 'unavailable' && (
            <span
              className={
                row.status === 'unavailable'
                  ? 'text-[var(--color-negative)]'
                  : 'text-[var(--color-caution)]'
              }
              title={row.reason ?? undefined}
            >
              {row.status}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
