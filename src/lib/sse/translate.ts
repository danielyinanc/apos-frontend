import type { UIMessageChunk } from 'ai';
import type { z } from 'zod';
import type { AposDataParts, AposMetadata } from '@/lib/ai/messages';
import type { EnvelopeOrNotice } from './envelope-stream';
import { AposDataSchemas } from './schema';

type Chunk = UIMessageChunk<AposMetadata, AposDataParts>;

/**
 * The single stateful stage of the bridge: translates validated apos
 * envelopes (and parser notices) into AI SDK v5-protocol UI message chunks.
 *
 * Tool events become DATA parts, not AI SDK tool parts: the contract gives
 * tool.started no arguments and tool.finished no result, and emitting
 * `input: {}` would fabricate a contract the backend never offered.
 *
 * Data parts reconcile by `id` in useChat, so the same id is reused across a
 * lifecycle (tool.started -> tool.finished rewrites one card in place).
 */
export function createAposToUiChunkStream(opts: {
  messageId: string;
  onLastSeq?: (seq: number) => void;
  onRunStarted?: (runId: string, threadId: string) => void;
  onInterrupt?: (runId: string, threadId: string, interruptId: string | null, blotter: unknown) => void;
}): TransformStream<EnvelopeOrNotice, Chunk> {
  let textBlockId: string | null = null;
  let accumulated = '';
  let blockIndex = 0;
  let started = false;
  let finished = false;
  const openTools: Record<string, string[]> = {};
  let toolCounter = 0;

  const openText = (ctrl: TransformStreamDefaultController<Chunk>) => {
    if (textBlockId) return;
    textBlockId = `txt:${opts.messageId}:${blockIndex++}`;
    ctrl.enqueue({ type: 'text-start', id: textBlockId });
  };
  const closeText = (ctrl: TransformStreamDefaultController<Chunk>) => {
    if (!textBlockId) return;
    ctrl.enqueue({ type: 'text-end', id: textBlockId });
    textBlockId = null;
  };

  const notice = (
    ctrl: TransformStreamDefaultController<Chunk>,
    severity: 'info' | 'warn' | 'error',
    code: string,
    message: string,
  ) => {
    ctrl.enqueue({
      type: 'data-apos-notice',
      data: { severity, code, message },
      transient: true,
    });
  };

  return new TransformStream({
    transform(item, ctrl) {
      if (item.kind === 'notice') {
        notice(ctrl, item.severity, item.code, item.message);
        return;
      }

      const env = item.envelope;
      opts.onLastSeq?.(env.seq);
      const tsMs = Math.round(env.ts * 1000);

      const parseData = <T>(schema: z.ZodType<T>): T | undefined => {
        const result = schema.safeParse(env.data);
        if (!result.success) {
          notice(
            ctrl,
            'error',
            'invalid_payload',
            `Event "${env.type}" (seq ${env.seq}) did not match its expected shape.`,
          );
          return undefined;
        }
        return result.data;
      };

      switch (env.type) {
        case 'run.started': {
          const d = parseData(AposDataSchemas['run.started']);
          if (!d) return;
          if (!started) {
            started = true;
            ctrl.enqueue({ type: 'start', messageId: opts.messageId });
          }
          opts.onRunStarted?.(env.run_id, env.thread_id);
          ctrl.enqueue({ type: 'start-step' });
          ctrl.enqueue({
            type: 'data-apos-run',
            id: `run:${env.run_id}`,
            data: {
              runId: env.run_id,
              threadId: env.thread_id,
              phase: 'started',
              resume: d.resume,
              lastSeq: env.seq,
            },
          });
          return;
        }

        case 'token': {
          const d = parseData(AposDataSchemas['token']);
          if (!d) return;
          openText(ctrl);
          accumulated += d.content;
          ctrl.enqueue({ type: 'text-delta', id: textBlockId as string, delta: d.content });
          return;
        }

        case 'message.completed': {
          const d = parseData(AposDataSchemas['message.completed']);
          if (!d) return;
          if (d.content !== accumulated) {
            if (d.content.startsWith(accumulated)) {
              openText(ctrl);
              const suffix = d.content.slice(accumulated.length);
              accumulated = d.content;
              ctrl.enqueue({ type: 'text-delta', id: textBlockId as string, delta: suffix });
            } else {
              notice(
                ctrl,
                'warn',
                'text_drift',
                'Streamed text diverged from the completed message.',
              );
            }
          }
          closeText(ctrl);
          return;
        }

        case 'tool.started': {
          const d = parseData(AposDataSchemas['tool.started']);
          if (!d) return;
          const id = `tool:${d.capability_id}:${toolCounter++}`;
          (openTools[d.capability_id] ??= []).push(id);
          ctrl.enqueue({
            type: 'data-apos-tool',
            id,
            data: { capabilityId: d.capability_id, phase: 'started' },
          });
          return;
        }

        case 'tool.finished':
        case 'tool.failed': {
          const d = parseData(
            env.type === 'tool.finished'
              ? AposDataSchemas['tool.finished']
              : AposDataSchemas['tool.failed'],
          );
          if (!d) return;
          const queue = openTools[d.capability_id];
          const id = queue?.shift() ?? `tool:${d.capability_id}:${toolCounter++}`;
          ctrl.enqueue({
            type: 'data-apos-tool',
            id,
            data: {
              capabilityId: d.capability_id,
              phase: env.type === 'tool.finished' ? 'finished' : 'failed',
              reason: (d as { reason?: string }).reason,
            },
          });
          return;
        }

        case 'citation': {
          const d = parseData(AposDataSchemas['citation']);
          if (!d) return;
          ctrl.enqueue({
            type: 'data-apos-citation',
            id: `cite:${env.run_id}:${d.citation_id}`,
            data: {
              citationId: d.citation_id,
              capabilityId: d.capability_id,
              bindingKind: d.binding_kind,
              tsMs,
              runId: env.run_id,
            },
          });
          return;
        }

        case 'compliance': {
          const d = parseData(AposDataSchemas['compliance']);
          if (!d) return;
          ctrl.enqueue({
            type: 'data-apos-compliance',
            id: `compliance:${env.run_id}`,
            data: { status: d.status, ruleIds: d.rules, tsMs, runId: env.run_id },
          });
          return;
        }

        case 'capability.unavailable':
        case 'capability.degraded': {
          const d = parseData(
            env.type === 'capability.unavailable'
              ? AposDataSchemas['capability.unavailable']
              : AposDataSchemas['capability.degraded'],
          );
          if (!d) return;
          const status = env.type === 'capability.unavailable' ? 'unavailable' : 'degraded';
          ctrl.enqueue({
            type: 'data-apos-capability-status',
            id: `cap:${env.run_id}:${d.capability_id}`,
            data: { capabilityId: d.capability_id, status, reason: d.reason, tsMs },
          });
          return;
        }

        case 'interrupt': {
          const d = parseData(AposDataSchemas['interrupt']);
          if (!d) return;
          opts.onInterrupt?.(env.run_id, env.thread_id, d.interrupt_id, d.blotter);
          closeText(ctrl);
          ctrl.enqueue({
            type: 'data-apos-interrupt',
            id: `interrupt:${env.run_id}`,
            data: {
              interruptId: d.interrupt_id,
              blotter: d.blotter,
              tsMs,
              runId: env.run_id,
              threadId: env.thread_id,
            },
          });
          return;
        }

        case 'run.finished': {
          const d = parseData(AposDataSchemas['run.finished']);
          if (!d) return;
          closeText(ctrl);
          finished = true;
          ctrl.enqueue({
            type: 'data-apos-run',
            id: `run:${env.run_id}`,
            data: {
              runId: env.run_id,
              threadId: env.thread_id,
              phase: 'finished',
              status: d.status,
              lastSeq: env.seq,
            },
          });
          ctrl.enqueue({
            type: 'message-metadata',
            messageMetadata: { runId: env.run_id, threadId: env.thread_id, lastSeq: env.seq },
          });
          ctrl.enqueue({ type: 'finish-step' });
          ctrl.enqueue({ type: 'finish' });
          return;
        }

        case 'error': {
          const d = parseData(AposDataSchemas['error']);
          closeText(ctrl);
          ctrl.enqueue({ type: 'error', errorText: d?.message ?? 'Unknown backend error' });
          return;
        }

        default: {
          ctrl.enqueue({
            type: 'data-apos-unknown',
            id: `unk:${env.run_id}:${env.seq}`,
            data: { rawType: env.type, raw: env.data, seq: env.seq },
          });
        }
      }
    },
    flush(ctrl) {
      // The contract guarantees run.finished is last; its absence (proxy
      // timeout, backend crash, client abort) is a hard error state so the
      // UI never sits in "streaming" forever.
      closeText(ctrl);
      if (started && !finished) {
        ctrl.enqueue({ type: 'error', errorText: 'Stream ended before run.finished' });
        ctrl.enqueue({ type: 'finish' });
      }
    },
  });
}
