'use client';

import { useEffect, useRef, useState } from 'react';
import type { Blotter } from '@/lib/sse/schema';
import { useApprovalStore } from '@/stores/approval-store';

export interface ApprovalCardProps {
  threadId: string;
  interruptId: string | null;
  blotter: Blotter;
  onDecide: (action: 'approve' | 'reject') => Promise<void>;
  onModify: (message: string) => Promise<void>;
}

/**
 * The highest-stakes surface in the app. No optimistic transitions: the
 * card renders "Submitting…" on click, never "Approved" -- the first real
 * confirmation is the server's run.started{resume:true}, the final one is
 * run.finished. Double-submit is guarded three ways: disabled fieldset,
 * a synchronous in-flight lock, and the backend's own 409.
 */
export function ApprovalCard({
  threadId,
  interruptId,
  blotter,
  onDecide,
  onModify,
}: ApprovalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState<'approve' | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyText, setModifyText] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'modify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useApprovalStore((s) => s.lock);
  const unlock = useApprovalStore((s) => s.unlock);
  const lockKey = `${threadId}:${interruptId ?? 'null'}`;

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (!cardRef.current?.contains(document.activeElement)) return;
      if (e.key === 'Escape') setArmed(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy]);

  if (interruptId === null) {
    return (
      <div
        role="group"
        aria-labelledby={`unapprovable-${blotter.id}`}
        className="rounded border border-[var(--color-caution)] bg-[var(--color-panel)] p-3"
      >
        <p id={`unapprovable-${blotter.id}`} className="font-semibold text-[var(--color-caution)]">
          This order cannot be approved from the UI
        </p>
        <p className="text-sm text-[var(--color-fg-muted)]">
          The server did not supply an approval id for {blotter.side} {blotter.quantity} of{' '}
          {blotter.instrument_id}.
        </p>
      </div>
    );
  }

  const decide = async (action: 'approve' | 'reject') => {
    if (!lock(lockKey)) return;
    setBusy(action);
    setError(null);
    try {
      await onDecide(action);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      unlock(lockKey);
    }
  };

  const submitModify = async () => {
    if (!modifyText.trim() || !lock(lockKey)) return;
    setBusy('modify');
    setError(null);
    try {
      await onModify(modifyText.trim());
      setModifyOpen(false);
      setModifyText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      unlock(lockKey);
    }
  };

  return (
    <div
      ref={cardRef}
      role="group"
      tabIndex={-1}
      aria-labelledby={`approval-${blotter.id}`}
      aria-busy={busy !== null}
      className="rounded border border-[var(--color-accent)] bg-[var(--color-panel)] p-3 outline-none"
    >
      <h2 id={`approval-${blotter.id}`} className="font-semibold">
        Approval required: {blotter.side} {blotter.quantity} of {blotter.instrument_id}
      </h2>
      <fieldset disabled={busy !== null} className="mt-3 flex flex-wrap gap-2">
        <legend className="sr-only">Decision</legend>
        <button
          type="button"
          onClick={() => decide('reject')}
          className="rounded border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] disabled:opacity-50"
        >
          {busy === 'reject' ? 'Submitting…' : 'Reject'}
        </button>
        <button
          type="button"
          onClick={() => setModifyOpen((v) => !v)}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Modify
        </button>
        {armed === 'approve' ? (
          <button
            type="button"
            onClick={() => decide('approve')}
            className="rounded bg-[var(--color-positive)] px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy === 'approve' ? 'Submitting…' : 'Confirm approve'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setArmed('approve')}
            className="rounded border border-[var(--color-positive)] px-3 py-1.5 text-sm text-[var(--color-positive)] disabled:opacity-50"
          >
            Approve
          </button>
        )}
      </fieldset>

      {modifyOpen && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-[var(--color-fg-muted)]">
            Modifying withdraws this proposal (a reject) and sends your instructions as a new
            message. This is composed by the frontend, not a native backend action.
          </p>
          <textarea
            value={modifyText}
            onChange={(e) => setModifyText(e.target.value)}
            disabled={busy !== null}
            className="rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
            rows={2}
            placeholder="e.g. reduce quantity to 2,000"
          />
          <button
            type="button"
            onClick={submitModify}
            disabled={busy !== null || !modifyText.trim()}
            className="self-start rounded border border-[var(--color-accent)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy === 'modify' ? 'Submitting…' : 'Send modification'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-negative)]">
          {error}
        </p>
      )}
    </div>
  );
}
