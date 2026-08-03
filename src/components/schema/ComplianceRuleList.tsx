'use client';

import { useGlossary } from '@/lib/glossary/provider';

const TONE_CLASS: Record<string, string> = {
  PASS: 'border-[var(--color-positive)] text-[var(--color-positive)]',
  FAIL: 'border-[var(--color-negative)] text-[var(--color-negative)]',
  ERROR: 'border-[var(--color-negative)] text-[var(--color-negative)]',
};

export function ComplianceRuleList({
  status,
  ruleIds,
}: {
  status: 'PASS' | 'FAIL' | 'ERROR';
  ruleIds: string[];
}) {
  const glossary = useGlossary();
  return (
    <div>
      <p className="text-sm">
        Rules evaluated: {ruleIds.length} · Result: <strong>{status}</strong>
        {ruleIds.length > 0 && (
          <span className="text-[var(--color-fg-muted)]">
            {' '}
            · The active pack does not publish per-rule outcomes.
          </span>
        )}
      </p>
      <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Compliance rules">
        {ruleIds.map((id) => {
          const entry = glossary.lookup(id);
          return (
            <li
              key={id}
              title={entry?.description ?? 'No description published by the active pack.'}
              className={`rounded border px-1.5 py-0.5 font-mono text-xs ${TONE_CLASS[status]}`}
            >
              {id}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
