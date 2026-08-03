'use client';

import type { CapabilityIndex } from '@/lib/format/capability';
import type { RegimeCurrent } from '@/lib/format/schemas';
import { toneOf } from '@/lib/format/regime';

const TONE_CLASS: Record<string, string> = {
  positive: 'text-[var(--color-positive)]',
  negative: 'text-[var(--color-negative)]',
  caution: 'text-[var(--color-caution)]',
  neutral: 'text-[var(--color-fg-muted)]',
};

export function RegimePanel({ data, index }: { data: RegimeCurrent; index: CapabilityIndex }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--color-fg-muted)]">No regime axes published.</p>;
  }
  return (
    <div className="flex flex-col gap-3" aria-label="Regime axes">
      {entries.map(([capabilityId, regime]) => (
        <div key={capabilityId}>
          <div className="text-xs text-[var(--color-fg-muted)]">{index.label(capabilityId)}</div>
          <ul className="flex flex-wrap gap-2">
            {regime.axes.map((axis) => {
              const value = regime.values[axis];
              const tone = value ? toneOf(value) : 'neutral';
              return (
                <li
                  key={axis}
                  className={`rounded border border-[var(--color-border)] px-2 py-0.5 text-sm ${TONE_CLASS[tone]}`}
                >
                  <span className="text-[var(--color-fg-muted)]">{axis}: </span>
                  {value ?? '—'}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
