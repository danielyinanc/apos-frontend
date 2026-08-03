'use client';

/**
 * Provider seam: apos-backend does not expose a glossary endpoint today.
 * This returns empty/disabled data now and is the ONLY place that needs to
 * change (to a TanStack Query call against a future GET /api/glossary) for
 * every rule chip, capability label, and unit token in the app to gain
 * tooltips with zero other component edits.
 */
export interface GlossaryEntry {
  term: string;
  description: string;
  source: string;
}

export function useGlossary(): {
  lookup: (key: string) => GlossaryEntry | undefined;
  enabled: boolean;
} {
  return { lookup: () => undefined, enabled: false };
}
