import type { UIMessage } from 'ai';
import type { Blotter } from '@/lib/sse/schema';

export type AposDataParts = {
  'apos-run': {
    runId: string;
    threadId: string;
    phase: 'started' | 'finished';
    resume?: boolean;
    status?: 'completed' | 'interrupted' | 'error';
    lastSeq: number;
  };
  'apos-tool': {
    capabilityId: string;
    phase: 'started' | 'finished' | 'failed';
    reason?: string;
  };
  'apos-citation': {
    citationId: string;
    capabilityId: string;
    bindingKind: 'in_process' | 'mcp' | 'cassette';
    tsMs: number;
    runId: string;
  };
  'apos-compliance': {
    status: 'PASS' | 'FAIL' | 'ERROR';
    ruleIds: string[];
    tsMs: number;
    runId: string;
  };
  'apos-capability-status': { capabilityId: string; reason: string; tsMs: number };
  'apos-interrupt': {
    interruptId: string | null;
    blotter: Blotter;
    tsMs: number;
    runId: string;
    threadId: string;
  };
  'apos-notice': { severity: 'info' | 'warn' | 'error'; code: string; message: string };
  'apos-unknown': { rawType: string; raw: unknown; seq: number };
};

export type AposMetadata = {
  runId: string;
  threadId: string;
  lastSeq: number;
};

export type AposUIMessage = UIMessage<AposMetadata, AposDataParts>;

export function isDataPart<K extends keyof AposDataParts>(
  part: AposUIMessage['parts'][number],
  key: K,
): part is Extract<AposUIMessage['parts'][number], { type: `data-${K}` }> {
  return part.type === `data-${key}`;
}
