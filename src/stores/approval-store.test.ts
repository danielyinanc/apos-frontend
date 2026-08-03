import { describe, expect, it } from 'vitest';
import { deriveApprovalOutcome } from './approval-store';
import type { Blotter } from '@/lib/sse/schema';

const blotter: Blotter = {
  id: 'bl-1',
  tenant_id: 't',
  portfolio_id: 'p',
  instrument_id: 'FN30-1',
  side: 'BUY',
  quantity: 5000,
  status: 'PENDING',
  compliance_result: null,
  attributes: {},
};

describe('deriveApprovalOutcome', () => {
  it('an interrupt always yields pending, regardless of compliance', () => {
    const outcome = deriveApprovalOutcome({
      interrupt: { interruptId: 'it-1', blotter, runId: 'r1', threadId: 't1' },
      compliance: { status: 'PASS', ruleIds: [] },
      finished: true,
    });
    expect(outcome?.s).toBe('pending');
  });

  it('compliance FAIL with no interrupt and a finished run yields blocked', () => {
    const outcome = deriveApprovalOutcome({
      compliance: { status: 'FAIL', ruleIds: ['EQ.LOCATE.001'] },
      finished: true,
    });
    expect(outcome).toEqual({ s: 'blocked', status: 'FAIL', ruleIds: ['EQ.LOCATE.001'] });
  });

  it('compliance ERROR with no interrupt and a finished run yields blocked', () => {
    const outcome = deriveApprovalOutcome({
      compliance: { status: 'ERROR', ruleIds: [] },
      finished: true,
    });
    expect(outcome?.s).toBe('blocked');
  });

  it('compliance PASS with no interrupt yields nothing (not blocked, not pending)', () => {
    const outcome = deriveApprovalOutcome({
      compliance: { status: 'PASS', ruleIds: [] },
      finished: true,
    });
    expect(outcome).toBeUndefined();
  });

  it('an unfinished run never derives blocked, even with a FAIL status seen so far', () => {
    const outcome = deriveApprovalOutcome({
      compliance: { status: 'FAIL', ruleIds: [] },
      finished: false,
    });
    expect(outcome).toBeUndefined();
  });

  it('no interrupt and no compliance data yields nothing', () => {
    const outcome = deriveApprovalOutcome({ finished: true });
    expect(outcome).toBeUndefined();
  });
});
