import 'server-only';
import { UI_MESSAGE_STREAM_HEADERS, JsonToSseTransformStream } from 'ai';
import { serverEnv } from '@/env/server';
import { createSseFrameStream } from '@/lib/sse/parse';
import { createAposEnvelopeStream } from '@/lib/sse/envelope-stream';
import { createAposToUiChunkStream } from '@/lib/sse/translate';
import { threadStore } from '@/lib/server/thread-store';

/**
 * Proxies a POST to an apos-backend SSE route, owns the Authorization header
 * (the backend has no CORS middleware and no login endpoint -- the browser
 * must never hold this token), and translates `event: apos` into the AI SDK
 * v5 UI message stream protocol. Shared by /api/chat and /api/approve: the
 * only difference between the two upstream calls is the path and body.
 */
export async function proxyAposSse(
  req: Request,
  upstreamPath: string,
  body: unknown,
): Promise<Response> {
  const env = serverEnv();

  let upstream: Response;
  try {
    upstream = await fetch(new URL(upstreamPath, env.BACKEND_URL), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.APOS_API_TOKEN}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: req.signal,
      cache: 'no-store',
      // @ts-expect-error -- undici half-duplex streaming flag, not in the DOM lib typings
      duplex: 'half',
    });
  } catch (cause) {
    return Response.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        detail: `Could not reach the backend at ${env.BACKEND_URL}: ${String(cause)}`,
      },
      { status: 502, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Preserve status and the RFC 9457 body verbatim -- 404 vs 409 on
    // /api/approve must stay distinguishable to the approval state machine.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/problem+json',
      },
    });
  }

  const messageId = crypto.randomUUID();

  // Note: `lastSeq` cannot be surfaced as a response header here -- headers
  // are written before any body bytes flow through a lazy ReadableStream.
  // It is carried instead in the `message-metadata` chunk emitted by the
  // translator on run.finished (see AposMetadata.lastSeq).
  const out = upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(createSseFrameStream())
    .pipeThrough(createAposEnvelopeStream())
    .pipeThrough(
      createAposToUiChunkStream({
        messageId,
        onRunStarted: (runId, threadId) => threadStore.touch(threadId, { lastRunId: runId }),
        onInterrupt: (_runId, threadId, interruptId, blotter) =>
          threadStore.setPendingInterrupt(threadId, {
            interruptId,
            blotter,
            capturedAtMs: Date.now(),
          }),
      }),
    )
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream());

  return new Response(out, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
      'x-apos-run-id': upstream.headers.get('x-apos-run-id') ?? '',
      'x-apos-thread-id': upstream.headers.get('x-apos-thread-id') ?? '',
    },
  });
}
