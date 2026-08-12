import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { packsActiveMbs } from '../../tests/factories/packs';
import { qk } from '@/lib/query/keys';
import type { PacksActive } from '@/lib/format/capability';
import { buildCapabilityIndex, patchCapabilityStatus } from '@/lib/format/capability';
import { CapabilityStatusList } from '@/components/schema/CapabilityStatusList';
import { Transcript } from '@/components/chat/Transcript';
import type { AposUIMessage } from '@/lib/ai/messages';

/**
 * Mirrors page.tsx's real wiring closely enough to prove the mid-stream
 * contract end to end: usePacksActive feeds CapabilityStatusList, and a
 * separately-rendered Transcript holds an in-flight assistant message. The
 * SSE onData patch is simulated directly via queryClient.setQueryData --
 * the same call page.tsx's onData handler makes -- so this proves the
 * panel updates without needing the full SSE/useChat machinery.
 */
function Harness() {
  const packs = useQuery({
    queryKey: qk.packs,
    queryFn: () => fetch('/api/apos/packs/active').then((r) => r.json()) as Promise<PacksActive>,
  });
  if (!packs.data) return <p>loading…</p>;
  const index = buildCapabilityIndex(packs.data);
  return <CapabilityStatusList index={index} />;
}

const inFlightMessage: AposUIMessage = {
  id: 'm1',
  role: 'assistant',
  parts: [{ type: 'text', text: 'Looking at option-adjusted spread…', state: 'streaming' }],
};

describe('capability status mid-stream update', () => {
  it('updates the capability panel from an SSE-shaped patch without losing the in-flight message', async () => {
    server.use(http.get('/api/apos/packs/active', () => HttpResponse.json(packsActiveMbs())));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <Harness />
        <Transcript
          messages={[inFlightMessage]}
          onApprove={async () => {}}
          onModify={async () => {}}
        />
      </QueryClientProvider>,
    );

    // Before the event: no capability issues panel, message streaming text visible.
    await screen.findByText(/Looking at option-adjusted spread/);
    expect(screen.queryByLabelText('Capability issues')).not.toBeInTheDocument();

    // Simulate the exact patch page.tsx's onData applies for a mid-stream
    // capability.unavailable event -- same call, same query key.
    client.setQueryData<PacksActive>(qk.packs, (old) =>
      old ? patchCapabilityStatus(old, 'mbs.oas', 'unavailable', 'model server down') : old,
    );

    // Panel updates...
    expect(await screen.findByLabelText('Capability issues')).toBeInTheDocument();
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText('model server down')).toBeInTheDocument();

    // ...and the in-flight message is still there, untouched.
    expect(screen.getByText(/Looking at option-adjusted spread/)).toBeInTheDocument();
  });
});
