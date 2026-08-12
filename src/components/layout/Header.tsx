'use client';

import { usePacksActive } from '@/lib/query/hooks';
import { buildCapabilityIndex, cannotAnswerSentence } from '@/lib/format/capability';

export function Header() {
  const packs = usePacksActive();
  const unavailable = packs.data
    ? packs.data.capabilities.filter((c) => c.status?.status === 'unavailable')
    : [];

  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 py-2">
        <h1 className="text-sm font-semibold">APOS</h1>
        <div className="text-xs text-[var(--color-fg-muted)]">
          {packs.data ? (
            <span>
              pack: {packs.data.pack_id}@{packs.data.version}
            </span>
          ) : (
            <span>loading pack…</span>
          )}
        </div>
      </div>
      {packs.data && unavailable.length > 0 && (
        <div
          role="status"
          className="border-t border-[var(--color-negative)] bg-[var(--color-panel)] px-4 py-2 text-xs text-[var(--color-negative)]"
        >
          {unavailable.length} capabilit{unavailable.length === 1 ? 'y' : 'ies'} unavailable —{' '}
          {(() => {
            const index = buildCapabilityIndex(packs.data);
            return unavailable
              .map((c) => cannotAnswerSentence(c.kind, index.label(c.capability_id)))
              .join(' ');
          })()}
        </div>
      )}
    </header>
  );
}
