'use client';

import { usePacksActive } from '@/lib/query/hooks';

export function Header() {
  const packs = usePacksActive();
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
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
    </header>
  );
}
