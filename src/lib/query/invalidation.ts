import type { CapabilityIndex } from '@/lib/format/capability';
import { qk } from './keys';

/** Which queries a finished tool invocation should invalidate, derived from
 * the capability's `kind` -- so a new pack's new capability invalidates
 * correctly with zero code changes here. */
export function invalidationKeysFor(capabilityId: string, index: CapabilityIndex) {
  switch (index.kind(capabilityId)) {
    case 'risk_measure':
      return [qk.risk];
    case 'regime':
      return [qk.regime];
    case 'tool':
      return [qk.portfolio, qk.risk];
    default:
      return [];
  }
}
