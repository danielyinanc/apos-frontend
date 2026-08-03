import { describe, expect, it } from 'vitest';
import { formatUnit } from './units';

describe('formatUnit', () => {
  it.each([
    ['percent', 12.5],
    ['fraction', 0.125],
    ['annualized_fraction', 0.08],
    ['daily_fraction', 0.001],
    ['ratio', 1.35],
    ['currency', 100000],
    ['years', 4.2],
    ['bps', 25],
    ['score', 0.87],
  ])('formats known unit "%s" without throwing', (unit, value) => {
    const result = formatUnit(value, unit);
    expect(result.unitKnown).toBe(true);
    expect(result.display.length).toBeGreaterThan(0);
  });

  it.each(['zscore', 'sharpe', 'nonsense_unit'])(
    'formats an unknown unit "%s" as a fallback, never throwing',
    (unit) => {
      const result = formatUnit(42, unit);
      expect(result.unitKnown).toBe(false);
      expect(result.display).toContain('42');
    },
  );

  it('percent formatting does not double-scale', () => {
    expect(formatUnit(12.5, 'percent').display).toBe('12.5%');
  });

  it('fraction formatting scales by 100', () => {
    expect(formatUnit(0.125, 'fraction').display).toBe('12.5%');
  });
});
