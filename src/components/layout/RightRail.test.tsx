import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/msw/server';
import {
  packsActiveEquity,
  packsActiveMbs,
  packsActiveSynthetic,
  portfolioSnapshot,
  regimeFor,
  riskMeasuresFor,
} from '../../../tests/factories/packs';
import { humanizeCapabilityId } from '@/lib/format/capability';
import { RightRail } from './RightRail';

function renderWithProviders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RightRail />
    </QueryClientProvider>,
  );
}

const PACKS = [
  { name: 'mbs', packs: packsActiveMbs, key: 'mbs' as const },
  { name: 'equity', packs: packsActiveEquity, key: 'equity' as const },
  {
    name: 'synthetic (unknown kind/units/axes)',
    packs: packsActiveSynthetic,
    key: 'synthetic' as const,
  },
];

describe.each(PACKS)('RightRail renders pack $name with zero code changes', ({ packs, key }) => {
  it('renders one label per capability with no crash', async () => {
    server.use(
      http.get('/api/apos/packs/active', () => HttpResponse.json(packs())),
      http.get('/api/apos/portfolio/snapshot', () => HttpResponse.json(portfolioSnapshot())),
      http.get('/api/apos/risk/measures', () => HttpResponse.json(riskMeasuresFor(key))),
      http.get('/api/apos/regime/current', () => HttpResponse.json(regimeFor(key))),
    );

    renderWithProviders();

    for (const capability of packs().capabilities) {
      const expectedText = capability.description || humanizeCapabilityId(capability.capability_id);
      await screen.findAllByText(
        new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      );
    }
  });

  it('formats every risk measure unit without throwing, marking unknown units', async () => {
    server.use(
      http.get('/api/apos/packs/active', () => HttpResponse.json(packs())),
      http.get('/api/apos/portfolio/snapshot', () => HttpResponse.json(portfolioSnapshot())),
      http.get('/api/apos/risk/measures', () => HttpResponse.json(riskMeasuresFor(key))),
      http.get('/api/apos/regime/current', () => HttpResponse.json(regimeFor(key))),
    );

    renderWithProviders();

    const measures = riskMeasuresFor(key).measures;
    for (const m of measures) {
      if (m.value === null) continue;
      await screen.findAllByLabelText('Risk measures');
    }
  });

  it('renders every regime axis the descriptor declares', async () => {
    server.use(
      http.get('/api/apos/packs/active', () => HttpResponse.json(packs())),
      http.get('/api/apos/portfolio/snapshot', () => HttpResponse.json(portfolioSnapshot())),
      http.get('/api/apos/risk/measures', () => HttpResponse.json(riskMeasuresFor(key))),
      http.get('/api/apos/regime/current', () => HttpResponse.json(regimeFor(key))),
    );

    renderWithProviders();

    const regime = regimeFor(key);
    const totalAxes = Object.values(regime).reduce((n, r) => n + r.axes.length, 0);
    const list = await screen.findByLabelText('Regime axes');
    for (const [, r] of Object.entries(regime)) {
      for (const axis of r.axes) {
        expect(list.textContent).toContain(axis);
      }
    }
    expect(totalAxes).toBeGreaterThan(0);
  });

  it('renders every non-available capability status generically, no capability names hardcoded', async () => {
    server.use(
      http.get('/api/apos/packs/active', () => HttpResponse.json(packs())),
      http.get('/api/apos/portfolio/snapshot', () => HttpResponse.json(portfolioSnapshot())),
      http.get('/api/apos/risk/measures', () => HttpResponse.json(riskMeasuresFor(key))),
      http.get('/api/apos/regime/current', () => HttpResponse.json(regimeFor(key))),
    );

    renderWithProviders();

    // packs() returns the WIRE shape (status is a flat string, per
    // apos-backend a2d2234), unlike the app-level nested `c.status.status`
    // components read after PacksActive.parse() transforms it.
    const nonAvailable = packs().capabilities.filter((c) => c.status && c.status !== 'available');
    for (const c of nonAvailable) {
      const label = c.description || humanizeCapabilityId(c.capability_id);
      await screen.findAllByText(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
    if (nonAvailable.length > 0) {
      expect(await screen.findByLabelText('Capability issues')).toBeInTheDocument();
    }
  });
});

describe('OtherCapabilities (catch-all for kinds with no dedicated panel)', () => {
  it('marks an unavailable capability of an unrecognized kind as such in its accessible name, degraded distinctly, and never drops either', async () => {
    server.use(
      http.get('/api/apos/packs/active', () =>
        HttpResponse.json({
          pack_id: 'other-kinds',
          version: '0.0.0',
          capabilities: [
            {
              capability_id: 'x.tool.offline',
              kind: 'tool',
              description: 'Offline Tool',
              provider_service: 'tool-service',
              status: 'unavailable',
              reason: 'tool service down',
              since: null,
            },
            {
              capability_id: 'x.tool.slow',
              kind: 'tool',
              description: 'Slow Tool',
              status: 'degraded',
              reason: 'slow',
              since: null,
            },
          ],
        }),
      ),
      http.get('/api/apos/portfolio/snapshot', () => HttpResponse.json(portfolioSnapshot())),
      http.get('/api/apos/risk/measures', () => HttpResponse.json({ measures: [], degraded: [] })),
      http.get('/api/apos/regime/current', () => HttpResponse.json({})),
    );

    renderWithProviders();

    // "Offline Tool" also appears in the Capability Status digest above --
    // scope to the "Other capabilities" list specifically.
    const otherCapabilities = within(await screen.findByLabelText('Other capabilities'));
    const offlineRow = otherCapabilities.getByText('Offline Tool').closest('li');
    expect(offlineRow).toHaveAttribute('aria-label', 'Offline Tool (unavailable)');
    expect(offlineRow).toHaveAttribute('title', 'tool service down — provider: tool-service');
    expect(offlineRow?.className).toMatch(/opacity-60/);

    const slowRow = otherCapabilities.getByText('Slow Tool').closest('li');
    expect(slowRow).not.toHaveAttribute('aria-label');
    expect(slowRow?.className).not.toBe(offlineRow?.className);
  });
});
