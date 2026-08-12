import { describe, expect, it } from 'vitest';
import { patchCapabilityStatus, statusSentence, type PacksActive } from './capability';

const base: PacksActive = {
  pack_id: 'mbs',
  version: '0.1.0',
  capabilities: [
    {
      capability_id: 'mbs.oas',
      kind: 'risk_measure',
      description: 'Option-adjusted spread',
      status: { capability_id: 'mbs.oas', status: 'available', reason: null, since: null },
    },
  ],
};

describe('patchCapabilityStatus', () => {
  it('patches an existing capability in place, leaving others untouched', () => {
    const patched = patchCapabilityStatus(base, 'mbs.oas', 'unavailable', 'model server down');
    expect(patched.capabilities).toHaveLength(1);
    expect(patched.capabilities[0]?.status).toEqual({
      capability_id: 'mbs.oas',
      status: 'unavailable',
      reason: 'model server down',
      since: null,
    });
    // original object untouched (immutable update)
    expect(base.capabilities[0]?.status?.status).toBe('available');
  });

  it('preserves an existing `since` timestamp across a patch', () => {
    const withSince: PacksActive = {
      ...base,
      capabilities: [
        {
          ...base.capabilities[0]!,
          status: {
            capability_id: 'mbs.oas',
            status: 'available',
            reason: null,
            since: '2026-01-01T00:00:00Z',
          },
        },
      ],
    };
    const patched = patchCapabilityStatus(withSince, 'mbs.oas', 'degraded', 'slow');
    expect(patched.capabilities[0]?.status?.since).toBe('2026-01-01T00:00:00Z');
  });

  it('appends a minimal entry for a capability id not yet in the descriptor', () => {
    const patched = patchCapabilityStatus(
      base,
      'mbs.new_thing',
      'unavailable',
      'unseen capability',
    );
    expect(patched.capabilities).toHaveLength(2);
    const added = patched.capabilities.find((c) => c.capability_id === 'mbs.new_thing');
    expect(added?.kind).toBe('unknown');
    expect(added?.status?.status).toBe('unavailable');
  });
});

describe('statusSentence', () => {
  it('uses the cannot-answer phrasing for unavailable', () => {
    expect(statusSentence('risk_measure', 'OAS', 'unavailable')).toMatch(/cannot be answered/);
  });

  it('uses "may be incomplete or stale" phrasing for degraded', () => {
    expect(statusSentence('risk_measure', 'OAS', 'degraded')).toMatch(/may be incomplete or stale/);
  });

  it('falls back to a neutral sentence for an unrecognized status, never throwing', () => {
    expect(() => statusSentence('risk_measure', 'OAS', 'melting')).not.toThrow();
    expect(statusSentence('risk_measure', 'OAS', 'melting')).toMatch(/unrecognized status/);
  });
});
