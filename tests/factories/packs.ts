import type { PacksActive } from '@/lib/format/capability';
import type { RegimeCurrent, RiskMeasures, PortfolioSnapshot } from '@/lib/format/schemas';

export function packsActiveMbs(): PacksActive {
  return {
    pack_id: 'mbs',
    version: '0.1.0',
    capabilities: [
      {
        capability_id: 'mbs.oas',
        kind: 'risk_measure',
        description: 'Option-adjusted spread',
        status: { capability_id: 'mbs.oas', status: 'available', reason: null, since: null },
      },
      {
        capability_id: 'mbs.regime.macro',
        kind: 'regime',
        description: 'Macro regime',
        status: {
          capability_id: 'mbs.regime.macro',
          status: 'available',
          reason: null,
          since: null,
        },
      },
      {
        capability_id: 'mbs.prepaid_speed',
        kind: 'risk_measure',
        description: 'Prepayment speed',
        status: {
          capability_id: 'mbs.prepaid_speed',
          status: 'degraded',
          reason: 'model server responding slowly',
          since: '2026-01-01T00:00:00Z',
        },
      },
    ],
  };
}

export function packsActiveEquity(): PacksActive {
  return {
    pack_id: 'equity',
    version: '0.1.0',
    capabilities: [
      {
        capability_id: 'equity.beta',
        kind: 'risk_measure',
        description: 'Beta',
        status: { capability_id: 'equity.beta', status: 'available', reason: null, since: null },
      },
      {
        capability_id: 'equity.regime.trend',
        kind: 'regime',
        description: 'Trend regime',
        status: {
          capability_id: 'equity.regime.trend',
          status: 'available',
          reason: null,
          since: null,
        },
      },
      {
        capability_id: 'equity.factor_exposure',
        kind: 'risk_measure',
        description: 'Factor exposure',
        status: {
          capability_id: 'equity.factor_exposure',
          status: 'degraded',
          reason: 'partial factor coverage',
          since: '2026-01-01T00:00:00Z',
        },
      },
    ],
  };
}

/** Deliberately breaks assumptions: unknown kind, null description, unknown
 * units, unavailable capability, three regime axes with unknown values. */
export function packsActiveSynthetic(): PacksActive {
  return {
    pack_id: 'crypto',
    version: '0.9.0',
    capabilities: [
      {
        capability_id: 'crypto.forecast.momentum',
        kind: 'forecast',
        description: null as unknown as string,
        status: null,
      },
      {
        capability_id: 'crypto.risk.sharpe_like',
        kind: 'risk_measure',
        description: 'Sharpe-like score',
        status: {
          capability_id: 'crypto.risk.sharpe_like',
          status: 'available',
          reason: null,
          since: null,
        },
      },
      {
        capability_id: 'crypto.risk.offline',
        kind: 'risk_measure',
        description: 'Offline measure',
        status: {
          capability_id: 'crypto.risk.offline',
          status: 'unavailable',
          reason: 'model server down',
          since: null,
        },
      },
      {
        capability_id: 'crypto.regime.market',
        kind: 'regime',
        description: 'Market regime',
        status: {
          capability_id: 'crypto.regime.market',
          status: 'available',
          reason: null,
          since: null,
        },
      },
      {
        capability_id: 'crypto.tool.oracle',
        kind: 'tool',
        description: 'Price oracle',
        // An unrecognized status value -- `status` is an open string, not a
        // closed enum, precisely so a value like this still renders (see
        // statusSentence()'s fallback branch) instead of failing the whole
        // packs/active fetch.
        status: {
          capability_id: 'crypto.tool.oracle',
          status: 'melting',
          reason: 'vendor reported an unknown state',
          since: '2026-01-01T00:00:00Z',
        },
      },
    ],
  };
}

export function riskMeasuresFor(pack: 'mbs' | 'equity' | 'synthetic'): RiskMeasures {
  if (pack === 'mbs') {
    return {
      measures: [
        {
          capability_id: 'mbs.oas',
          value: 3.5255,
          unit: 'percent',
          citation_id: 'c:abc123',
          provenance: { method: 'stub:v1' },
        },
      ],
      degraded: [],
    };
  }
  if (pack === 'equity') {
    return {
      measures: [
        {
          capability_id: 'equity.beta',
          value: 1.12,
          unit: 'ratio',
          citation_id: 'c:def456',
          provenance: { method: 'stub:v1' },
        },
      ],
      degraded: [],
    };
  }
  return {
    measures: [
      {
        capability_id: 'crypto.risk.sharpe_like',
        value: 0.87,
        unit: 'zscore',
        citation_id: 'c:zzz',
        provenance: { method: 'stub:v1' },
      },
    ],
    degraded: [{ capability_id: 'crypto.risk.offline', reason: 'model server down' }],
  };
}

export function regimeFor(pack: 'mbs' | 'equity' | 'synthetic'): RegimeCurrent {
  if (pack === 'mbs') {
    return { 'mbs.regime.macro': { axes: ['macro'], values: { macro: 'neutral' } } };
  }
  if (pack === 'equity') {
    return { 'equity.regime.trend': { axes: ['trend'], values: { trend: 'rising' } } };
  }
  return {
    'crypto.regime.market': {
      axes: ['sentiment', 'liquidity', 'volatility'],
      values: { sentiment: 'contango', liquidity: 'backwardation', volatility: 'chop' },
    },
  };
}

export function portfolioSnapshot(): PortfolioSnapshot {
  return {
    id: 'pf-1',
    tenant_id: 'tenant-mbs',
    as_of: new Date(0).toISOString(),
    cash: 100_000,
    positions: [
      { instrument_id: 'FN30-1', quantity: 5000, market_value: 5_100_000, attributes: {} },
    ],
    attributes: {},
  };
}
