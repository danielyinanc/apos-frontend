'use client';

import type { CapabilityIndex } from '@/lib/format/capability';
import { cannotAnswerSentence } from '@/lib/format/capability';

export function CapabilityStatusList({ index }: { index: CapabilityIndex }) {
  const issues = index.capabilities.filter((c) => c.status && c.status.status !== 'available');
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Capability issues">
      {issues.map((c) => {
        const label = index.label(c.capability_id);
        const isUnavailable = c.status?.status === 'unavailable';
        return (
          <li
            key={c.capability_id}
            className={`rounded border-l-4 p-2 text-sm ${
              isUnavailable
                ? 'border-[var(--color-negative)] bg-[var(--color-panel)]'
                : 'border-[var(--color-caution)] bg-[var(--color-panel)]'
            }`}
          >
            <div className="font-medium">{label}</div>
            <div className="text-[var(--color-fg-muted)]">
              {c.status?.reason ?? 'No reason published.'}
            </div>
            {isUnavailable && (
              <div className="mt-1 text-[var(--color-negative)]">
                Cannot answer: {cannotAnswerSentence(c.kind, label)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
