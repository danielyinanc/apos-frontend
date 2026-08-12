'use client';

import type { CapabilityIndex } from '@/lib/format/capability';
import { statusSentence } from '@/lib/format/capability';

const STATUS_LABEL: Record<string, string> = {
  degraded: 'degraded',
  unavailable: 'unavailable',
};

function relativeSince(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(diffSeconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
}

export function CapabilityStatusList({ index }: { index: CapabilityIndex }) {
  const issues = index.capabilities.filter((c) => c.status && c.status.status !== 'available');
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Capability issues">
      {issues.map((c) => {
        const label = index.label(c.capability_id);
        const status = c.status?.status ?? 'unavailable';
        const isUnavailable = status === 'unavailable';
        const statusLabel = STATUS_LABEL[status] ?? status;
        return (
          <li
            key={c.capability_id}
            className={`rounded border-l-4 p-2 text-sm ${
              isUnavailable
                ? 'border-[var(--color-negative)] bg-[var(--color-panel)]'
                : 'border-[var(--color-caution)] bg-[var(--color-panel)]'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {label}
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-normal uppercase ${
                  isUnavailable
                    ? 'bg-[var(--color-negative)] text-[var(--color-bg)]'
                    : status === 'degraded'
                      ? 'bg-[var(--color-caution)] text-[var(--color-bg)]'
                      : 'bg-[var(--color-fg-muted)] text-[var(--color-bg)]'
                }`}
              >
                {statusLabel}
              </span>
            </div>
            <div className="text-[var(--color-fg-muted)]">
              {c.status?.reason ?? 'No reason published.'}
            </div>
            {c.provider_service && (
              <div className="text-xs text-[var(--color-fg-muted)]">
                Provider: {c.provider_service}
              </div>
            )}
            {c.status?.since && (
              <div className="text-xs text-[var(--color-fg-muted)]">
                Since {relativeSince(c.status.since)}
              </div>
            )}
            <div
              className={`mt-1 ${isUnavailable ? 'text-[var(--color-negative)]' : 'text-[var(--color-caution)]'}`}
            >
              {statusSentence(c.kind, label, status)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
