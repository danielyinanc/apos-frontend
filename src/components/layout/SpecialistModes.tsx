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
          const allUnavailable = mode.capabilityIds.every(
            (id) => index.status(id)?.status === 'unavailable',
          );
          return (
            <li key={mode.id}>
              <button
                type="button"
                aria-pressed={selected}
                aria-disabled={allUnavailable || undefined}
                disabled={allUnavailable}
                title={
                  allUnavailable ? 'Every capability in this focus is unavailable.' : undefined
                }
                onClick={() => setFocusMode(selected ? null : mode.id)}
                className={`w-full rounded px-1.5 py-1 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? 'bg-[var(--color-panel)] text-[var(--color-accent)]'
                    : 'text-[var(--color-fg)]'
                }`}
              >
                {mode.label}
              </button>
              <ul className="ml-2 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-2">
                {mode.capabilityIds.map((id) => {
                  const capabilityStatus = index.status(id);
                  const status = capabilityStatus?.status;
                  const isUnavailable = status === 'unavailable';
                  const isDegraded = status === 'degraded';
                  const providerService = index.get(id)?.provider_service;
                  const titleParts = [
                    capabilityStatus?.reason,
                    providerService ? `provider: ${providerService}` : null,
                  ].filter(Boolean);

                  const label = index.label(id);
                  return (
                    <li
                      key={id}
                      className={`flex items-center gap-1.5 text-xs ${
                        isUnavailable
                          ? 'pointer-events-none text-[var(--color-fg-muted)] opacity-60'
                          : isDegraded
                            ? 'text-[var(--color-caution)]'
                            : 'text-[var(--color-fg-muted)]'
                      }`}
                      // aria-disabled isn't valid on the implicit listitem
                      // role and there is no click handler here to disable
                      // in the first place -- unavailability is communicated
                      // through the accessible name instead.
                      aria-label={isUnavailable ? `${label} (unavailable)` : undefined}
                      title={titleParts.length > 0 ? titleParts.join(' — ') : undefined}
                    >
                      {isDegraded && (
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-caution)]"
                        />
                      )}
                      {label}
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
