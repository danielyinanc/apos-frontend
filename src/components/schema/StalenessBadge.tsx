'use client';

export function StalenessBadge({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const ageMs = Date.now() - dataUpdatedAt;
  const tier = ageMs < 30_000 ? 'fresh' : ageMs < 5 * 60_000 ? 'aging' : 'stale';
  const label = tier === 'fresh' ? 'Live' : tier === 'aging' ? 'Aging' : 'Stale';
  const cls =
    tier === 'fresh'
      ? 'text-[var(--color-positive)]'
      : tier === 'aging'
        ? 'text-[var(--color-caution)]'
        : 'text-[var(--color-negative)]';
  return (
    <span
      className={`text-[10px] tracking-wide uppercase ${cls}`}
      title={new Date(dataUpdatedAt).toISOString()}
    >
      {label}
    </span>
  );
}
