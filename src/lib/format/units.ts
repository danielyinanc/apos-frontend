import type { Unit } from '@/lib/sse/schema';

export interface FormattedValue {
  display: string;
  raw: number;
  unitToken: Unit;
  unitKnown: boolean;
  a11yLabel: string;
}

interface FormatContext {
  locale?: string;
}

interface UnitFormatter {
  format(v: number, ctx: FormatContext): Omit<FormattedValue, 'raw' | 'unitToken' | 'unitKnown'>;
}

const pctFmt =
  (scale: number, suffix = '') =>
  (v: number, ctx: FormatContext) => {
    const scaled = v * scale;
    const display = `${new Intl.NumberFormat(ctx.locale ?? 'en-US', {
      maximumFractionDigits: 2,
    }).format(scaled)}%${suffix}`;
    return { display, a11yLabel: `${scaled} percent${suffix}` };
  };

const plainFmt =
  (maxFrac: number, suffix = '') =>
  (v: number, ctx: FormatContext) => {
    const display = `${new Intl.NumberFormat(ctx.locale ?? 'en-US', {
      maximumFractionDigits: maxFrac,
    }).format(v)}${suffix}`;
    return { display, a11yLabel: `${v}${suffix}` };
  };

const moneyFmt = () => (v: number, ctx: FormatContext) => {
  const display = new Intl.NumberFormat(ctx.locale ?? 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
  return { display, a11yLabel: `${v} US dollars` };
};

// Units actually observed in circulation from apos-backend, plus the
// spec-assumed set (years/bps/score), all handled by the same registry.
const REGISTRY: Record<string, UnitFormatter> = {
  percent: { format: pctFmt(1) },
  fraction: { format: pctFmt(100) },
  annualized_fraction: { format: pctFmt(100, ' p.a.') },
  daily_fraction: { format: pctFmt(100, '/day') },
  ratio: { format: plainFmt(3) },
  currency: { format: moneyFmt() },
  years: { format: plainFmt(2, ' yr') },
  bps: { format: plainFmt(1, ' bps') },
  score: { format: plainFmt(2) },
};

const unknownUnitsWarned = new Set<string>();

function reportUnknownUnit(unit: string): void {
  if (unknownUnitsWarned.has(unit)) return;
  unknownUnitsWarned.add(unit);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[apos] Unknown unit "${unit}" -- rendering unformatted with a fallback chip.`);
  }
}

const DEFAULT: UnitFormatter = {
  format: (v, ctx) => ({
    display: new Intl.NumberFormat(ctx.locale ?? 'en-US', { maximumSignificantDigits: 6 }).format(
      v,
    ),
    a11yLabel: `${v}`,
  }),
};

export function formatUnit(value: number, unit: Unit, ctx: FormatContext = {}): FormattedValue {
  const formatter = REGISTRY[unit];
  if (!formatter) reportUnknownUnit(unit);
  const base = (formatter ?? DEFAULT).format(value, ctx);
  return { ...base, raw: value, unitToken: unit, unitKnown: Boolean(formatter) };
}
