import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCapabilityIndex, type PacksActive } from '@/lib/format/capability';
import type { RiskMeasures } from '@/lib/format/schemas';
import { RiskMeasureList } from './RiskMeasureList';

const descriptor: PacksActive = {
  pack_id: 'test',
  version: '0.0.0',
  capabilities: [
    {
      capability_id: 'r.available',
      kind: 'risk_measure',
      description: 'Available Measure',
      status: { capability_id: 'r.available', status: 'available', reason: null, since: null },
    },
    {
      capability_id: 'r.uncovered_unavailable',
      kind: 'risk_measure',
      description: 'Uncovered Unavailable Measure',
      status: {
        capability_id: 'r.uncovered_unavailable',
        status: 'unavailable',
        reason: 'model server down',
        since: null,
      },
    },
    {
      capability_id: 'r.covered_degraded',
      kind: 'risk_measure',
      description: 'Covered Degraded Measure',
      status: {
        capability_id: 'r.covered_degraded',
        status: 'degraded',
        reason: 'descriptor says degraded',
        since: null,
      },
    },
  ],
};

describe('RiskMeasureList', () => {
  it('shows an explicit unavailable marker for a measure the endpoint omitted entirely, never a blank cell', () => {
    const data: RiskMeasures = {
      measures: [
        {
          capability_id: 'r.available',
          value: 1.23,
          unit: 'ratio',
          citation_id: 'c:1',
          provenance: { method: 'in_process' },
        },
      ],
      degraded: [],
    };
    const index = buildCapabilityIndex(descriptor);
    render(<RiskMeasureList data={data} index={index} />);

    expect(screen.getByText('Uncovered Unavailable Measure')).toBeInTheDocument();
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    // never a dash or blank -- the word "unavailable" is the marker
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('lets the endpoint degraded[] row win when a capability appears in both channels', () => {
    const data: RiskMeasures = {
      measures: [],
      degraded: [{ capability_id: 'r.covered_degraded', reason: 'endpoint reason wins' }],
    };
    const index = buildCapabilityIndex(descriptor);
    render(<RiskMeasureList data={data} index={index} />);

    // Exactly one row for this capability, not two contradictory rows.
    expect(screen.getAllByText('Covered Degraded Measure')).toHaveLength(1);
    expect(screen.getByText('degraded')).toBeInTheDocument();
  });

  it('never renders a stale prior value for a measure that has gone unavailable', () => {
    const data: RiskMeasures = {
      measures: [], // the endpoint stopped returning it -- no stale value in sight
      degraded: [],
    };
    const index = buildCapabilityIndex(descriptor);
    render(<RiskMeasureList data={data} index={index} />);

    expect(screen.getByText('Uncovered Unavailable Measure')).toBeInTheDocument();
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });
});
