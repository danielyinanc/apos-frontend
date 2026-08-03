'use client';

import type { Capability } from '@/lib/format/capability';

export interface SpecialistMode {
  id: string;
  label: string;
  capabilityIds: string[];
  source: 'derived' | 'backend';
}

/**
 * apos-backend has no "specialist mode" concept and /api/chat/stream has no
 * mode field, so a mode can never change model behaviour today. Modes are
 * DERIVED by grouping capabilities by `kind` and surfaced as a "Focus" view
 * filter, explicitly not a model instruction -- presenting a locally-derived
 * grouping as something that changes the model's behavior would be
 * misleading on a compliance-adjacent surface.
 */
export function deriveSpecialistModes(capabilities: Capability[]): SpecialistMode[] {
  const byKind = new Map<string, string[]>();
  for (const c of capabilities) {
    const list = byKind.get(c.kind) ?? [];
    list.push(c.capability_id);
    byKind.set(c.kind, list);
  }
  const LABELS: Record<string, string> = {
    risk_measure: 'Risk Measures',
    regime: 'Regime',
    signal: 'Signals',
    tool: 'Tools',
  };
  return [...byKind.entries()].map(([kind, ids]) => ({
    id: kind,
    label: LABELS[kind] ?? kind,
    capabilityIds: ids,
    source: 'derived',
  }));
}
