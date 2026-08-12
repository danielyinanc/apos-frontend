import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCapabilityIndex, type PacksActive } from '@/lib/format/capability';
import { CapabilityStatusList } from './CapabilityStatusList';

function descriptor(overrides: Partial<PacksActive['capabilities'][number]>[]): PacksActive {
  return {
    pack_id: 'test',
    version: '0.0.0',
    capabilities: overrides.map((o, i) => ({
      capability_id: `cap.${i}`,
      kind: 'risk_measure',
      description: `Capability ${i}`,
      status: null,
      ...o,
    })),
  };
}

describe('CapabilityStatusList', () => {
  it('renders nothing when every capability is available', () => {
    const index = buildCapabilityIndex(
      descriptor([
        { status: { capability_id: 'cap.0', status: 'available', reason: null, since: null } },
      ]),
    );
    const { container } = render(<CapabilityStatusList index={index} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a degraded capability, visually distinct from unavailable', () => {
    const index = buildCapabilityIndex(
      descriptor([
        {
          capability_id: 'cap.degraded',
          status: {
            capability_id: 'cap.degraded',
            status: 'degraded',
            reason: 'model server responding slowly',
            since: null,
          },
        },
      ]),
    );
    render(<CapabilityStatusList index={index} />);
    expect(screen.getByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('model server responding slowly')).toBeInTheDocument();
    expect(screen.getByText(/may be incomplete or stale/)).toBeInTheDocument();
  });

  it('renders an unavailable capability with a cannot-answer sentence', () => {
    const index = buildCapabilityIndex(
      descriptor([
        {
          capability_id: 'cap.down',
          status: {
            capability_id: 'cap.down',
            status: 'unavailable',
            reason: 'model server down',
            since: null,
          },
        },
      ]),
    );
    render(<CapabilityStatusList index={index} />);
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByText(/cannot be answered right now/)).toBeInTheDocument();
  });

  it('renders an unrecognized status value safely, without crashing', () => {
    const index = buildCapabilityIndex(
      descriptor([
        {
          capability_id: 'cap.weird',
          status: {
            capability_id: 'cap.weird',
            status: 'melting',
            reason: 'vendor reported an unknown state',
            since: null,
          },
        },
      ]),
    );
    expect(() => render(<CapabilityStatusList index={index} />)).not.toThrow();
    expect(screen.getByText('melting')).toBeInTheDocument();
    expect(screen.getByText(/unrecognized status \("melting"\)/)).toBeInTheDocument();
  });

  it('renders `since` as a relative time when present', () => {
    const index = buildCapabilityIndex(
      descriptor([
        {
          capability_id: 'cap.since',
          status: {
            capability_id: 'cap.since',
            status: 'degraded',
            reason: 'r',
            since: new Date(Date.now() - 5 * 60_000).toISOString(),
          },
        },
      ]),
    );
    render(<CapabilityStatusList index={index} />);
    expect(screen.getByText(/Since/)).toBeInTheDocument();
  });
});
