import { z } from 'zod';

/**
 * The backend's SSE wire envelope. Every event uses the literal SSE name
 * `event: apos`; the real type lives inside this JSON payload.
 * `type` stays z.string() (not an enum) -- an unrecognised type must render
 * as a visible debug part, never be dropped or throw.
 */
export const AposEnvelope = z
  .object({
    v: z.literal(1),
    seq: z.number().int(),
    run_id: z.string(),
    thread_id: z.string(),
    ts: z.number(), // float epoch SECONDS -- never `new Date(ts)` directly
    type: z.string(),
    data: z.unknown(),
  })
  .passthrough();
export type AposEnvelope = z.infer<typeof AposEnvelope>;

export const Blotter = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    portfolio_id: z.string(),
    instrument_id: z.string(),
    side: z.enum(['BUY', 'SELL']),
    quantity: z.number(),
    status: z.literal('PENDING'),
    compliance_result: z.null(),
    attributes: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();
export type Blotter = z.infer<typeof Blotter>;

export const AposDataSchemas = {
  'run.started': z
    .object({ thread_id: z.string(), run_id: z.string(), resume: z.boolean().optional() })
    .passthrough(),
  token: z.object({ content: z.string() }).passthrough(),
  'message.completed': z.object({ content: z.string() }).passthrough(),
  'tool.started': z.object({ capability_id: z.string() }).passthrough(),
  'tool.finished': z.object({ capability_id: z.string() }).passthrough(),
  'tool.failed': z.object({ capability_id: z.string(), reason: z.string() }).passthrough(),
  'capability.unavailable': z
    .object({ capability_id: z.string(), reason: z.string() })
    .passthrough(),
  citation: z
    .object({
      capability_id: z.string(),
      citation_id: z.string(),
      binding_kind: z.enum(['in_process', 'mcp', 'cassette']),
    })
    .passthrough(),
  compliance: z
    .object({ status: z.enum(['PASS', 'FAIL', 'ERROR']), rules: z.array(z.string()) })
    .passthrough(),
  interrupt: z.object({ interrupt_id: z.string().nullable(), blotter: Blotter }).passthrough(),
  'run.finished': z.object({ status: z.enum(['completed', 'interrupted', 'error']) }).passthrough(),
  error: z.object({ message: z.string() }).passthrough(),
} as const;

export type AposEventType = keyof typeof AposDataSchemas;

export type AposDataFor<T extends AposEventType> = z.infer<(typeof AposDataSchemas)[T]>;

/** Open unions: unknown values are typed and renderable, never rejected. */
export type KnownUnit =
  | 'percent'
  | 'currency'
  | 'fraction'
  | 'annualized_fraction'
  | 'daily_fraction'
  | 'ratio'
  | 'years'
  | 'bps'
  | 'score';
export type Unit = KnownUnit | (string & {});
