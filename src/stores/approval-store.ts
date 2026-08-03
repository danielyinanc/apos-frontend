import { create } from 'zustand';
import type { Blotter } from '@/lib/sse/schema';

export type ApprovalState =
  | { s: 'idle' }
  | { s: 'pending'; interruptId: string | null; blotter: Blotter; threadId: string; runId: string }
  | { s: 'unapprovable'; blotter: Blotter; reason: 'missing_interrupt_id' }
  | {
      s: 'in_flight';
      interruptId: string;
      action: 'approve' | 'reject' | 'modify';
      blotter: Blotter;
    }
  | { s: 'accepted'; interruptId: string; action: 'approve' | 'reject' | 'modify' }
  | {
      s: 'settled';
      action: 'approve' | 'reject' | 'modify';
      finishStatus: 'completed' | 'interrupted' | 'error';
    }
  | { s: 'blocked'; status: 'FAIL' | 'ERROR'; ruleIds: string[] }
  | { s: 'stale'; detail: string }
  | { s: 'not_pending'; detail: string }
  | { s: 'not_found' }
  | { s: 'error'; detail: string };

interface ApprovalStore {
  byThread: Record<string, ApprovalState>;
  /** Synchronous double-submit guard, set before any await. */
  inFlightKey: string | null;
  set: (threadId: string, state: ApprovalState) => void;
  get: (threadId: string) => ApprovalState;
  lock: (key: string) => boolean;
  unlock: (key: string) => void;
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  byThread: {},
  inFlightKey: null,
  set: (threadId, state) => set((prev) => ({ byThread: { ...prev.byThread, [threadId]: state } })),
  get: (threadId) => get().byThread[threadId] ?? { s: 'idle' },
  lock: (key) => {
    if (get().inFlightKey !== null) return false;
    set({ inFlightKey: key });
    return true;
  },
  unlock: (key) => {
    if (get().inFlightKey === key) set({ inFlightKey: null });
  },
}));

/**
 * The load-bearing inference: an interrupt is raised ONLY when compliance
 * passes. On FAIL/ERROR the backend auto-rejects the blotter server-side and
 * emits no interrupt event, so "blocked" must be derived from a finished run
 * whose compliance status was not PASS and which carries no interrupt.
 */
export function deriveApprovalOutcome(args: {
  interrupt?: { interruptId: string | null; blotter: Blotter; runId: string; threadId: string };
  compliance?: { status: 'PASS' | 'FAIL' | 'ERROR'; ruleIds: string[] };
  finished: boolean;
}): ApprovalState | undefined {
  if (args.interrupt) {
    return {
      s: 'pending',
      interruptId: args.interrupt.interruptId,
      blotter: args.interrupt.blotter,
      threadId: args.interrupt.threadId,
      runId: args.interrupt.runId,
    };
  }
  if (args.finished && args.compliance && args.compliance.status !== 'PASS') {
    return { s: 'blocked', status: args.compliance.status, ruleIds: args.compliance.ruleIds };
  }
  return undefined;
}
