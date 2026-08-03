'use client';

import {
  ApiError,
  usePacksActive,
  usePortfolioSnapshot,
  useRegimeCurrent,
  useRiskMeasures,
} from '@/lib/query/hooks';
import { buildCapabilityIndex } from '@/lib/format/capability';
import { RiskMeasureList } from '@/components/schema/RiskMeasureList';
import { RegimePanel } from '@/components/schema/RegimePanel';
import { CapabilityStatusList } from '@/components/schema/CapabilityStatusList';
import { StalenessBadge } from '@/components/schema/StalenessBadge';

function Section({
  title,
  dataUpdatedAt,
  children,
}: {
  title: string;
  dataUpdatedAt?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--color-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {dataUpdatedAt ? <StalenessBadge dataUpdatedAt={dataUpdatedAt} /> : null}
      </div>
      {children}
    </section>
  );
}

export function RightRail() {
  const packs = usePacksActive();
  const portfolio = usePortfolioSnapshot();
  const regime = useRegimeCurrent();
  const risk = useRiskMeasures();

  if (packs.isPending) {
    return <div className="p-3 text-sm text-[var(--color-fg-muted)]">Loading pack…</div>;
  }
  if (packs.isError) {
    return (
      <div className="p-3 text-sm text-[var(--color-negative)]">
        Could not load the active pack: {packs.error.message}
      </div>
    );
  }

  const index = buildCapabilityIndex(packs.data);

  return (
    <aside className="flex h-full flex-col overflow-y-auto" aria-label="Portfolio and risk context">
      <Section title="Portfolio">
        {portfolio.isPending && <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>}
        {portfolio.isError && (
          <p className="text-sm text-[var(--color-negative)]">{portfolio.error.message}</p>
        )}
        {portfolio.data && (
          <p className="text-sm">
            {portfolio.data.positions.length} positions · cash{' '}
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
              portfolio.data.cash,
            )}
          </p>
        )}
      </Section>

      <Section title="Regime" dataUpdatedAt={regime.dataUpdatedAt || undefined}>
        {regime.isPending && <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>}
        {regime.isError && (
          <p className="text-sm text-[var(--color-negative)]" role="status">
            {regime.error instanceof ApiError && regime.error.problem?.capability_id
              ? `${regime.error.problem.capability_id} is unavailable: ${regime.error.problem.detail}`
              : regime.error.message}
          </p>
        )}
        {regime.data && <RegimePanel data={regime.data} index={index} />}
      </Section>

      <Section title="Risk Measures" dataUpdatedAt={risk.dataUpdatedAt || undefined}>
        {risk.isPending && <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>}
        {risk.isError && (
          <p className="text-sm text-[var(--color-negative)]">{risk.error.message}</p>
        )}
        {risk.data && <RiskMeasureList data={risk.data} index={index} />}
      </Section>

      <Section title="Capability Status">
        <CapabilityStatusList index={index} />
      </Section>

      <OtherCapabilities index={index} />
    </aside>
  );
}

/**
 * Catch-all for capabilities of a `kind` this UI has no dedicated panel for
 * (today: anything that isn't risk_measure/regime). Without this, a
 * capability of an unrecognized kind would render nowhere at all -- silently
 * dropped, which schema-driven rendering forbids. It should stay empty for
 * the packs shipped today and populate the moment a pack introduces a new
 * capability kind.
 */
function OtherCapabilities({ index }: { index: ReturnType<typeof buildCapabilityIndex> }) {
  const shown = new Set(['risk_measure', 'regime']);
  const rest = index.capabilities.filter((c) => !shown.has(c.kind));
  if (rest.length === 0) return null;
  return (
    <Section title="Other Capabilities">
      <ul className="flex flex-col gap-1" aria-label="Other capabilities">
        {rest.map((c) => (
          <li key={c.capability_id} className="flex items-center justify-between text-sm">
            <span title={c.capability_id}>{index.label(c.capability_id)}</span>
            <span className="text-[10px] text-[var(--color-fg-muted)]">{c.kind}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
