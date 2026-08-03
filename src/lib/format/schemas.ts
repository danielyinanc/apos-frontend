import { z } from 'zod';

const Provenance = z
  .object({
    method: z.string(),
    model_id: z.string().nullable().optional(),
    model_version: z.string().nullable().optional(),
    snapshot_id: z.string().nullable().optional(),
    as_of: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .passthrough();

export const RiskMeasure = z
  .object({
    capability_id: z.string(),
    value: z.number().nullable(),
    unit: z.string().nullable(),
    citation_id: z.string(),
    provenance: Provenance.nullable(),
  })
  .passthrough();
export type RiskMeasure = z.infer<typeof RiskMeasure>;

export const DegradedMeasure = z.object({ capability_id: z.string(), reason: z.string() });

export const RiskMeasures = z.object({
  measures: z.array(RiskMeasure),
  degraded: z.array(DegradedMeasure),
});
export type RiskMeasures = z.infer<typeof RiskMeasures>;

export const RegimeAxis = z
  .object({
    axes: z.array(z.string()),
    values: z.record(z.string(), z.string()),
    as_of: z.string().nullable().optional(),
    provenance: Provenance.optional(),
  })
  .passthrough();

/** keyed by regime capability id, e.g. "mbs.regime.macro" */
export const RegimeCurrent = z.record(z.string(), RegimeAxis);
export type RegimeCurrent = z.infer<typeof RegimeCurrent>;

export const Position = z
  .object({
    instrument_id: z.string(),
    quantity: z.number(),
    market_value: z.number(),
    attributes: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

export const PortfolioSnapshot = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    as_of: z.string(),
    cash: z.number(),
    positions: z.array(Position),
    attributes: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();
export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshot>;

export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
  capability_id: z.string().optional(),
});
export type Problem = z.infer<typeof Problem>;
