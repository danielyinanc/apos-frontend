import type { SseFrame } from './parse';
import { AposEnvelope } from './schema';

export interface AposNotice {
  kind: 'notice';
  severity: 'info' | 'warn' | 'error';
  code: string;
  message: string;
  detail?: unknown;
}

export interface AposEnvelopeItem {
  kind: 'envelope';
  envelope: AposEnvelope;
}

// AposEnvelope's zod .passthrough() gives it an index signature, which would
// make a `kind` discriminant on it collide with AposNotice's `kind: 'notice'`
// (TS can no longer prove the two are disjoint). Wrapping the envelope keeps
// the discriminant on a plain object with no index signature.
export type EnvelopeOrNotice = AposEnvelopeItem | AposNotice;

/**
 * Validates each SSE frame's JSON payload against the envelope schema.
 * Frames whose SSE `event` name is not the literal `apos` become a notice
 * rather than vanishing -- an unexpected named event must stay visible.
 * A JSON-parse or schema failure on a KNOWN envelope shape is also a loud
 * notice, never a silent drop or an unhandled throw that kills the stream.
 */
export function createAposEnvelopeStream(): TransformStream<SseFrame, EnvelopeOrNotice> {
  return new TransformStream({
    transform(frame, ctrl) {
      if (frame.event !== 'apos') {
        ctrl.enqueue({
          kind: 'notice',
          severity: 'info',
          code: 'unknown_sse_event',
          message: `Received an SSE event named "${frame.event}", expected "apos".`,
          detail: frame,
        });
        return;
      }

      let raw: unknown;
      try {
        raw = JSON.parse(frame.data);
      } catch (cause) {
        ctrl.enqueue({
          kind: 'notice',
          severity: 'error',
          code: 'invalid_json',
          message: 'SSE payload was not valid JSON.',
          detail: { data: frame.data, error: String(cause) },
        });
        return;
      }

      const result = AposEnvelope.safeParse(raw);
      if (!result.success) {
        ctrl.enqueue({
          kind: 'notice',
          severity: 'error',
          code: 'invalid_envelope',
          message: 'SSE payload did not match the apos envelope schema.',
          detail: { raw, issues: result.error.issues },
        });
        return;
      }

      ctrl.enqueue({ kind: 'envelope', envelope: result.data });
    },
  });
}
