'use client';

import type { CapabilityIndex } from '@/lib/format/capability';
import { deriveSpecialistModes } from '@/lib/modes/provider';
import { useUiStore } from '@/stores/ui-store';

/**
 * Left-rail "Focus" list, grouped from the active pack's capabilities (see
 * deriveSpecialistModes -- this is a view-scope filter, never a model
 * instruction). Each capability inside a group shows its own availability so
 * a degraded/unavailable capability is visible where an analyst would look
 * for it, not just in the right rail.
 */
export function SpecialistModes({ index }: { index: CapabilityIndex }) {
  const modes = deriveSpecialistModes(index.capabilities);
  const focusModeId = useUiStore((s) => s.focusModeId);
  const setFocusMode = useUiStore((s) => s.setFocusMode);

  if (modes.length === 0) return null;

  return (
    <nav aria-label="Focus">
      <h2 className="mb-2 text-sm font-semibold">Focus</h2>
      <ul className="flex flex-col gap-3">
        {modes.map((mode) => {
          const selected = focusModeId === mode.id;
          return (
            <li key={mode.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => setFocusMode(selected ? null : mode.id)}
                className={`w-full rounded px-1.5 py-1 text-left text-sm font-medium ${
                  selected
                    ? 'bg-[var(--color-panel)] text-[var(--color-accent)]'
                    : 'text-[var(--color-fg)]'
                }`}
              >
                {mode.label}
              </button>
              <ul className="ml-2 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-2">
                {mode.capabilityIds.map((id) => {
                  const status = index.status(id)?.status;
                  const isUnavailable = status === 'unavailable';
                  const isDegraded = status === 'degraded';
                  return (
                    <li
                      key={id}
                      className={`flex items-center gap-1.5 text-xs ${
                        isUnavailable
                          ? 'text-[var(--color-fg-muted)] opacity-60'
                          : isDegraded
                            ? 'text-[var(--color-caution)]'
                            : 'text-[var(--color-fg-muted)]'
                      }`}
                      title={
                        index.status(id)?.reason
                          ? `${index.status(id)?.reason}`
                          : isUnavailable
                            ? 'Unavailable'
                            : undefined
                      }
                    >
                      {isDegraded && (
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-caution)]"
                        />
                      )}
                      {index.label(id)}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
