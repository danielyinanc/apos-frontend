import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/msw/server';
import { packsActiveMbs } from '../../../tests/factories/packs';
import type { PacksActiveWire } from '@/lib/format/capability';
import { Header } from './Header';

function renderWithProviders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Header />
    </QueryClientProvider>,
  );
}

describe('Header', () => {
  it('shows no banner when every capability is available', async () => {
    server.use(http.get('/api/apos/packs/active', () => HttpResponse.json(packsActiveMbs())));
    renderWithProviders();
    await screen.findByText(/pack: mbs/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a persistent banner naming what cannot be answered when a capability is unavailable', async () => {
    const withUnavailable: PacksActiveWire = {
      ...packsActiveMbs(),
      capabilities: [
        ...packsActiveMbs().capabilities,
        {
          capability_id: 'mbs.factor_exposure',
          kind: 'risk_measure',
          description: 'Factor exposure',
          status: 'unavailable',
          reason: 'model server down',
          since: null,
        },
      ],
    };
    server.use(http.get('/api/apos/packs/active', () => HttpResponse.json(withUnavailable)));
    renderWithProviders();

    const banner = await screen.findByRole('status');
    expect(banner.textContent).toMatch(/1 capability unavailable/);
    expect(banner.textContent).toMatch(/cannot be answered right now/);
  });
});
