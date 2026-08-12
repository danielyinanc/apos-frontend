import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCapabilityIndex, type PacksActive } from '@/lib/format/capability';
import { SpecialistModes } from './SpecialistModes';

const descriptor: PacksActive = {
  pack_id: 'test',
  version: '0.0.0',
  capabilities: [
    {
      capability_id: 'r.available',
      kind: 'risk_measure',
      description: 'Available Measure',
      provider_service: null,
      status: { capability_id: 'r.available', status: 'available', reason: null, since: null },
    },
    {
      capability_id: 'r.down',
      kind: 'risk_measure',
      description: 'Down Measure',
      provider_service: 'risk-analytics',
      status: {
        capability_id: 'r.down',
        status: 'unavailable',
        reason: 'model server down',
        since: null,
      },
    },
    {
      capability_id: 'r.slow',
      kind: 'risk_measure',
      description: 'Slow Measure',
      provider_service: null,
      status: {
        capability_id: 'r.slow',
        status: 'degraded',
        reason: 'slow responses',
        since: null,
      },
    },
  ],
};

describe('SpecialistModes', () => {
  it('greys out an unavailable capability, marks it aria-disabled, and surfaces the reason + provider on hover', () => {
    const index = buildCapabilityIndex(descriptor);
    render(<SpecialistModes index={index} />);

    const item = screen.getByText('Down Measure').closest('li');
    expect(item).toHaveAttribute('title', 'model server down — provider: risk-analytics');
    expect(item).toHaveAttribute('aria-label', 'Down Measure (unavailable)');
    expect(item?.className).toMatch(/opacity-60/);
  });

  it('renders degraded distinctly from both available and unavailable, and never marks it unavailable in its name', () => {
    const index = buildCapabilityIndex(descriptor);
    render(<SpecialistModes index={index} />);

    const available = screen.getByText('Available Measure').closest('li');
    const degraded = screen.getByText('Slow Measure').closest('li');
    const unavailable = screen.getByText('Down Measure').closest('li');

    expect(degraded?.className).not.toBe(available?.className);
    expect(degraded?.className).not.toBe(unavailable?.className);
    expect(degraded).toHaveAttribute('title', 'slow responses');
    expect(degraded).not.toHaveAttribute('aria-label');
    expect(available).not.toHaveAttribute('aria-label');
  });

  it('selecting a mode toggles its pressed state', async () => {
    const index = buildCapabilityIndex(descriptor);
    render(<SpecialistModes index={index} />);
    const button = screen.getByRole('button', { name: /risk measures/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('disables the mode button entirely when every capability in it is unavailable', () => {
    const allDown: PacksActive = {
      pack_id: 'test',
      version: '0.0.0',
      capabilities: [
        {
          capability_id: 'r.down1',
          kind: 'risk_measure',
          description: 'Down One',
          provider_service: null,
          status: { capability_id: 'r.down1', status: 'unavailable', reason: 'down', since: null },
        },
        {
          capability_id: 'r.down2',
          kind: 'risk_measure',
          description: 'Down Two',
          provider_service: null,
          status: { capability_id: 'r.down2', status: 'unavailable', reason: 'down', since: null },
        },
      ],
    };
    const index = buildCapabilityIndex(allDown);
    render(<SpecialistModes index={index} />);
    const button = screen.getByRole('button', { name: /risk measures/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
