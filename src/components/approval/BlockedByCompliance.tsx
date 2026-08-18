'use client';

export function BlockedByCompliance({
  status,
  ruleIds,
}: {
  status: 'FAIL' | 'ERROR';
  ruleIds: string[];
}) {
  return (
    <div
      role="status"
      aria-label="Order blocked by compliance and auto-rejected by the server"
      className="rounded border-2 border-[var(--color-negative)] bg-[var(--color-panel)] p-3"
    >
      <p className="font-semibold text-[var(--color-negative)]">
        Order blocked by compliance and auto-rejected by the server
      </p>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        No approval was requested because compliance did not pass (status: {status}).
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Rules evaluated">
        {ruleIds.map((id) => (
          <li
            key={id}
            className="rounded border border-[var(--color-negative)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-negative)]"
          >
            {id}
          </li>
        ))}
      </ul>
    </div>
  );
}
