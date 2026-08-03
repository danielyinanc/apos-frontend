import { describe, expect, it } from 'vitest';
import type { AposUIMessage } from '@/lib/ai/messages';
import { findBlockedOutcome } from './Transcript';

function message(parts: AposUIMessage['parts']): AposUIMessage {
  return { id: 'm1', role: 'assistant', parts };
}

function runPart(
  runId: string,
  phase: 'started' | 'finished',
  status?: 'completed' | 'interrupted' | 'error',
) {
  return {
    type: 'data-apos-run' as const,
    id: `run:${runId}`,
    data: { runId, threadId: 't1', phase, status, lastSeq: 1 },
  };
}

function compliancePart(runId: string, status: 'PASS' | 'FAIL' | 'ERROR') {
  return {
    type: 'data-apos-compliance' as const,
    id: `compliance:${runId}`,
    data: { status, ruleIds: ['EQ.LOCATE.001'], tsMs: 0, runId },
  };
}

function interruptPart(runId: string) {
  return {
    type: 'data-apos-interrupt' as const,
    id: `interrupt:${runId}`,
    data: {
      interruptId: 'it-1',
      blotter: {
        id: 'bl-1',
        tenant_id: 't',
        portfolio_id: 'p',
        instrument_id: 'FN30-1',
        side: 'BUY' as const,
        quantity: 5000,
        status: 'PENDING' as const,
        compliance_result: null,
        attributes: {},
      },
      tsMs: 0,
      runId,
      threadId: 't1',
    },
  };
}

describe('findBlockedOutcome', () => {
  it('does not report blocked while the run is still streaming (compliance seen, no run.finished yet)', () => {
    const msg = message([runPart('r1', 'started'), compliancePart('r1', 'FAIL')]);
    expect(findBlockedOutcome(msg)).toBeNull();
  });

  it('reports blocked once the run has finished with a non-PASS compliance and no interrupt', () => {
    const msg = message([
      runPart('r1', 'started'),
      compliancePart('r1', 'FAIL'),
      runPart('r1', 'finished', 'completed'),
    ]);
    expect(findBlockedOutcome(msg)).toEqual({ status: 'FAIL', ruleIds: ['EQ.LOCATE.001'] });
  });

  it('does not report blocked when an interrupt exists for the same run (compliance passed)', () => {
    const msg = message([
      runPart('r1', 'started'),
      compliancePart('r1', 'PASS'),
      interruptPart('r1'),
      runPart('r1', 'finished', 'interrupted'),
    ]);
    expect(findBlockedOutcome(msg)).toBeNull();
  });

  it('does not report blocked if the finished run errored rather than completed', () => {
    const msg = message([
      runPart('r1', 'started'),
      compliancePart('r1', 'FAIL'),
      runPart('r1', 'finished', 'error'),
    ]);
    expect(findBlockedOutcome(msg)).toBeNull();
  });

  it('evaluates only the LATEST run, ignoring a blocked outcome from an earlier resumed run', () => {
    const msg = message([
      // first run: blocked
      runPart('r1', 'started'),
      compliancePart('r1', 'FAIL'),
      runPart('r1', 'finished', 'completed'),
      // resumed run after approve/modify: passes cleanly
      runPart('r2', 'started'),
      compliancePart('r2', 'PASS'),
      runPart('r2', 'finished', 'completed'),
    ]);
    expect(findBlockedOutcome(msg)).toBeNull();
  });

  it('returns null when there is no run part at all', () => {
    expect(findBlockedOutcome(message([]))).toBeNull();
  });
});
