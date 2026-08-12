import { describe, expect, it } from 'vitest';
import type { UIMessageChunk } from 'ai';
import type { AposDataParts, AposMetadata } from '@/lib/ai/messages';
import { createSseFrameStream } from './parse';
import { createAposEnvelopeStream } from './envelope-stream';
import { createAposToUiChunkStream } from './translate';

type Chunk = UIMessageChunk<AposMetadata, AposDataParts>;

async function run(sse: string) {
  const chunks: Chunk[] = [];
  const frameStream = createSseFrameStream();
  const fw = frameStream.writable.getWriter();
  const envelopeStream = createAposEnvelopeStream();
  const translateStream = createAposToUiChunkStream({ messageId: 'm1' });
  frameStream.readable.pipeThrough(envelopeStream).pipeThrough(translateStream);
  const reader = translateStream.readable.getReader();

  const reading = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  await fw.write(sse);
  await fw.close();
  await reading;
  return chunks;
}

function envelope(
  seq: number,
  type: string,
  data: unknown,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    v: 1,
    seq,
    run_id: 'r1',
    thread_id: 't1',
    ts: 1000 + seq,
    type,
    data,
    ...overrides,
  };
}

function sseOf(...envelopes: unknown[]): string {
  return envelopes.map((e) => `event: apos\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

describe('createAposToUiChunkStream', () => {
  it('translates a happy-path run into start/text/finish chunks', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'token', { content: 'Hello ' }),
      envelope(3, 'token', { content: 'world' }),
      envelope(4, 'message.completed', { content: 'Hello world' }),
      envelope(5, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    const types = chunks.map((c) => c.type);
    expect(types[0]).toBe('start');
    expect(types).toContain('text-start');
    expect(types).toContain('text-delta');
    expect(types).toContain('text-end');
    expect(types[types.length - 1]).toBe('finish');
  });

  it('pairs tool.started with tool.finished under the same data part id', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'tool.started', { capability_id: 'mbs.oas' }),
      envelope(3, 'tool.finished', { capability_id: 'mbs.oas' }),
      envelope(4, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    const toolChunks = chunks.filter((c) => c.type === 'data-apos-tool');
    expect(toolChunks).toHaveLength(2);
    expect(toolChunks[0]?.id).toBe(toolChunks[1]?.id);
  });

  it('renders an interrupt as a data-apos-interrupt part after the run', async () => {
    const blotter = {
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
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'compliance', { status: 'PASS', rules: ['EQ.LOCATE.001'] }),
      envelope(3, 'interrupt', { interrupt_id: 'it-1', blotter }),
      envelope(4, 'run.finished', { status: 'interrupted' }),
    );
    const chunks = await run(sse);
    const interrupt = chunks.find((c) => c.type === 'data-apos-interrupt');
    expect(interrupt).toBeDefined();
    if (interrupt?.type === 'data-apos-interrupt') {
      expect(interrupt.data.interruptId).toBe('it-1');
      expect(interrupt.data.blotter.instrument_id).toBe('FN30-1');
    }
  });

  it('compliance FAIL with no interrupt produces no interrupt part', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'compliance', { status: 'FAIL', rules: ['EQ.LOCATE.001'] }),
      envelope(3, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    expect(chunks.find((c) => c.type === 'data-apos-interrupt')).toBeUndefined();
    const compliance = chunks.find((c) => c.type === 'data-apos-compliance');
    expect(compliance?.type === 'data-apos-compliance' && compliance.data.status).toBe('FAIL');
  });

  it('an unrecognized event type becomes a visible data-apos-unknown part, never dropped', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'future.event', { anything: true }),
      envelope(3, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    const unknown = chunks.find((c) => c.type === 'data-apos-unknown');
    expect(unknown).toBeDefined();
  });

  it('a malformed known-type payload produces a notice, not a crash', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'token', { wrong_field: true }),
      envelope(3, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    expect(chunks.some((c) => c.type === 'data-apos-notice')).toBe(true);
  });

  it('emits an error and finish if the stream ends before run.finished', async () => {
    const sse = sseOf(envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }));
    const chunks = await run(sse);
    expect(chunks[chunks.length - 2]?.type).toBe('error');
    expect(chunks[chunks.length - 1]?.type).toBe('finish');
  });

  it('an SSE event not named apos becomes a notice, not silently dropped', async () => {
    const sse = 'event: ping\ndata: {}\n\n';
    const chunks = await run(sse);
    expect(chunks.some((c) => c.type === 'data-apos-notice')).toBe(true);
  });

  it('capability.unavailable emits a data-apos-capability-status part with status "unavailable"', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'capability.unavailable', {
        capability_id: 'mbs.oas',
        reason: 'model server down',
      }),
      envelope(3, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    const part = chunks.find((c) => c.type === 'data-apos-capability-status');
    expect(part?.type === 'data-apos-capability-status' && part.data).toEqual({
      capabilityId: 'mbs.oas',
      status: 'unavailable',
      reason: 'model server down',
      tsMs: 1002000,
    });
  });

  it('capability.degraded emits a data-apos-capability-status part with status "degraded"', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'capability.degraded', {
        capability_id: 'mbs.prepaid_speed',
        reason: 'slow responses',
      }),
      envelope(3, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    const part = chunks.find((c) => c.type === 'data-apos-capability-status');
    expect(part?.type === 'data-apos-capability-status' && part.data.status).toBe('degraded');
    expect(part?.type === 'data-apos-capability-status' && part.data.capabilityId).toBe(
      'mbs.prepaid_speed',
    );
  });

  it('a capability going unavailable mid-stream reconciles in place if the same capability was already degraded (same id)', async () => {
    const sse = sseOf(
      envelope(1, 'run.started', { thread_id: 't1', run_id: 'r1' }),
      envelope(2, 'capability.degraded', { capability_id: 'mbs.oas', reason: 'slow' }),
      envelope(3, 'capability.unavailable', { capability_id: 'mbs.oas', reason: 'now down' }),
      envelope(4, 'run.finished', { status: 'completed' }),
    );
    const chunks = await run(sse);
    const statusChunks = chunks.filter((c) => c.type === 'data-apos-capability-status');
    expect(statusChunks).toHaveLength(2);
    expect(statusChunks[0]?.type === 'data-apos-capability-status' && statusChunks[0].id).toBe(
      statusChunks[1]?.type === 'data-apos-capability-status' && statusChunks[1].id,
    );
  });
});
