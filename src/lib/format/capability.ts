import { z } from 'zod';

/**
 * apos-backend's read routes return FastAPI `dict[str, Any]`, so the
 * generated OpenAPI types collapse to `{[key: string]: unknown}` -- they
 * carry no real shape. Same rule as the SSE envelope: the type is a zod
 * schema validated at the BFF boundary, not a hand-typed interface that can
 * silently drift from the backend.
 */
export const CapabilityStatus = z
  .object({
    capability_id: z.string(),
    status: z.enum(['available', 'degraded', 'unavailable']),
    reason: z.string().nullable(),
    since: z.string().nullable(),
  })
  .nullable();

export const Capability = z.object({
  capability_id: z.string(),
  kind: z.string(), // open union: risk_measure|regime|signal|tool today, more later
  // A backend build could plausibly send null/missing here even though
  // today's contract types it as `str = ""` -- never let that crash rendering.
  description: z.string().nullable().optional(),
  status: CapabilityStatus,
});
export type Capability = z.infer<typeof Capability>;

export const PacksActive = z.object({
  pack_id: z.string(),
  version: z.string(),
  capabilities: z.array(Capability),
});
export type PacksActive = z.infer<typeof PacksActive>;

/** "mbs.risk.oas" -> "Risk · Oas"; "equity.regime.trend" -> "Regime · Trend" */
export function humanizeCapabilityId(id: string): string {
  const segments = id.split('.').filter(Boolean);
  const tail = segments.length > 1 ? segments.slice(1) : segments;
  return tail
    .map((s) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' · ');
}

export interface CapabilityIndex {
  packId: string;
  version: string;
  capabilities: Capability[];
  get(id: string): Capability | undefined;
  label(id: string): string;
  kind(id: string): string;
  status(id: string): Capability['status'];
  byKind(kind: string): Capability[];
}

export function buildCapabilityIndex(descriptor: PacksActive): CapabilityIndex {
  const byId = new Map(descriptor.capabilities.map((c) => [c.capability_id, c]));
  return {
    packId: descriptor.pack_id,
    version: descriptor.version,
    capabilities: descriptor.capabilities,
    get: (id) => byId.get(id),
    label: (id) => byId.get(id)?.description || humanizeCapabilityId(id),
    kind: (id) => byId.get(id)?.kind ?? 'unknown',
    status: (id) => byId.get(id)?.status ?? null,
    byKind: (kind) => descriptor.capabilities.filter((c) => c.kind === kind),
  };
}

/** What a missing capability of a given kind means, generated generically so
 * a pack we've never seen still produces an honest sentence. */
const CANNOT_ANSWER: Record<string, (label: string) => string> = {
  risk_measure: (l) => `Risk questions involving ${l} cannot be answered right now.`,
  regime: (l) =>
    `${l} regime classification is unavailable; regime-conditional answers are not supported right now.`,
  signal: (l) => `Signals derived from ${l} cannot be produced right now.`,
  tool: (l) => `${l} cannot be invoked right now.`,
};

export function cannotAnswerSentence(kind: string, label: string): string {
  return (CANNOT_ANSWER[kind] ?? ((l: string) => `${l} is unavailable right now.`))(label);
}
