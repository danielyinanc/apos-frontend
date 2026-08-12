import { z } from 'zod';

/**
 * apos-backend's read routes return FastAPI `dict[str, Any]`, so the
 * generated OpenAPI types collapse to `{[key: string]: unknown}` -- they
 * carry no real shape. Same rule as the SSE envelope: the type is a zod
 * schema validated at the BFF boundary, not a hand-typed interface that can
 * silently drift from the backend.
 */
/**
 * The APP-level status shape every component in this codebase reads. It
 * predates apos-backend commit a2d2234, which flattened `status`/`reason`/
 * `since` onto the capability itself on the wire (see Capability below) --
 * this nested shape is kept as the post-parse representation so none of the
 * many consumers of `c.status?.status` / `?.reason` / `?.since` had to
 * change when the wire shape did.
 */
export const CapabilityStatusShape = z.object({
  capability_id: z.string(),
  // Open union, not z.enum -- a status value this build doesn't recognize
  // must still validate and render (neutrally), never fail the whole
  // packs/active fetch. See statusSentence()'s unrecognized-value branch.
  status: z.string(),
  reason: z.string().nullable(),
  since: z.string().nullable(),
});
export type CapabilityStatus = z.infer<typeof CapabilityStatusShape> | null;

/**
 * `Capability` is a WIRE-to-APP transform, not a passthrough validator:
 * apos-backend (commit a2d2234) flattens `provider_service`, `status`,
 * `reason`, `since` directly onto each capability object -- `status` is now
 * a plain string (available|degraded|unavailable|...), not the nested object
 * this module used to receive. A `status_detail` field also ships, carrying
 * the old nested shape, for backward compatibility with other consumers; we
 * don't need it since we rebuild the same nested shape ourselves below.
 *
 * `z.input<typeof Capability>` is the WIRE type (used by test factories/MSW
 * fixtures, which stand in for backend JSON); `z.infer<typeof Capability>`
 * (the default) is the APP type every component reads.
 */
export const Capability = z
  .object({
    capability_id: z.string(),
    kind: z.string(), // open union: risk_measure|regime|signal|tool today, more later
    // A backend build could plausibly send null/missing here even though
    // today's contract types it as `str = ""` -- never let that crash rendering.
    description: z.string().nullable().optional(),
    // Which service answers this capability, so a broken model server can be
    // told apart from a broken capability. Optional/nullable defensively --
    // this field did not exist before a2d2234.
    provider_service: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    since: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((c) => ({
    capability_id: c.capability_id,
    kind: c.kind,
    description: c.description ?? null,
    provider_service: c.provider_service ?? null,
    status: c.status
      ? {
          capability_id: c.capability_id,
          status: c.status,
          reason: c.reason ?? null,
          since: c.since ?? null,
        }
      : null,
  }));
export type Capability = z.infer<typeof Capability>;
/** The wire shape backend JSON (and therefore test factories) is built in. */
export type CapabilityWire = z.input<typeof Capability>;

export const PacksActive = z.object({
  pack_id: z.string(),
  version: z.string(),
  capabilities: z.array(Capability),
});
export type PacksActive = z.infer<typeof PacksActive>;
export type PacksActiveWire = z.input<typeof PacksActive>;

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

/** Same idea as CANNOT_ANSWER, but for a degraded (not fully down) capability
 * -- answers may still be produced, just not trusted at face value. */
const MAY_BE_INCOMPLETE: Record<string, (label: string) => string> = {
  risk_measure: (l) => `Risk questions involving ${l} may be incomplete or stale.`,
  regime: (l) => `${l} regime classification may be incomplete or stale.`,
  signal: (l) => `Signals derived from ${l} may be incomplete or stale.`,
  tool: (l) => `${l} may return incomplete or stale results.`,
};

/**
 * Sentence for any status value, including one this build has never seen --
 * `status` is a free string from the wire (see CapabilityStatus.status is a
 * closed enum today, but SSE `capability.*` events widen it to an open
 * union), so this never throws on an unrecognized value.
 */
export function statusSentence(kind: string, label: string, status: string): string {
  if (status === 'unavailable') return cannotAnswerSentence(kind, label);
  if (status === 'degraded') {
    return (MAY_BE_INCOMPLETE[kind] ?? ((l: string) => `${l} may be degraded right now.`))(label);
  }
  return `${label} reported an unrecognized status ("${status}").`;
}

/**
 * Applies an SSE capability.degraded/unavailable event to a cached
 * packs/active descriptor -- pure so the mid-stream cache patch in page.tsx
 * is unit-testable without React or TanStack Query. Unknown capability ids
 * are appended as a minimal entry rather than dropped, since the descriptor
 * may not have been fetched yet when the event arrives.
 */
export function patchCapabilityStatus(
  data: PacksActive,
  capabilityId: string,
  status: string,
  reason: string,
): PacksActive {
  const existing = data.capabilities.find((c) => c.capability_id === capabilityId);
  const patchedStatus: Capability['status'] = {
    capability_id: capabilityId,
    status,
    reason,
    since: existing?.status?.since ?? null,
  };
  if (!existing) {
    return {
      ...data,
      capabilities: [
        ...data.capabilities,
        {
          capability_id: capabilityId,
          kind: 'unknown',
          description: null,
          provider_service: null,
          status: patchedStatus,
        },
      ],
    };
  }
  return {
    ...data,
    capabilities: data.capabilities.map((c) =>
      c.capability_id === capabilityId ? { ...c, status: patchedStatus } : c,
    ),
  };
}
