import 'server-only';
import { z } from 'zod';
import { serverEnv } from '@/env/server';
import { proxyAposSse } from '@/lib/server/proxy-sse';
import { createSseFrameStream } from '@/lib/sse/parse';
import { createAposEnvelopeStream } from '@/lib/sse/envelope-stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ModifyRequestSchema = z.object({
  thread_id: z.string(),
  interrupt_id: z.string(),
  message: z.string().min(1),
});

/**
 * Reads the reject response's SSE body through to its `run.finished` event
 * and returns that event's `status`, or null if the stream ended without
 * one. `ReadableStream.cancel()` ABORTS a stream rather than draining it --
 * using it here would let the modify's chat request race the backend's own
 * processing of the reject on the same thread, which can leave the original
 * approval unresolved. Reading to completion is the only way to know the
 * reject actually reached a terminal state before composing the next call.
 */
async function drainRejectStream(res: Response): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(createSseFrameStream())
    .pipeThrough(createAposEnvelopeStream())
    .getReader();

  let finishedStatus: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value.kind === 'envelope' && value.envelope.type === 'run.finished') {
      const data = value.envelope.data as { status?: unknown };
      finishedStatus = typeof data.status === 'string' ? data.status : null;
    }
  }
  return finishedStatus;
}

/**
 * The backend accepts only action: "approve" | "reject" on /api/approve --
 * a "modify" value is a 422. Modify is therefore COMPOSED at the BFF: reject
 * the current proposal, then send the user's free text as a new chat message
 * on the same thread. The backend re-plans and re-runs compliance, so the
 * resulting stream genuinely is the re-check result. This is not a native
 * backend capability and the UI must say so.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = ModifyRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { type: 'about:blank', title: 'Bad Request', status: 400, detail: parsed.error.message },
      { status: 400, headers: { 'content-type': 'application/problem+json' } },
    );
  }
  const { thread_id, interrupt_id, message } = parsed.data;
  const env = serverEnv();

  const rejectRes = await fetch(new URL('/api/approve', env.BACKEND_URL), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.APOS_API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ thread_id, interrupt_id, action: 'reject' }),
  });

  if (!rejectRes.ok) {
    return new Response(rejectRes.body, {
      status: rejectRes.status,
      headers: {
        'content-type': rejectRes.headers.get('content-type') ?? 'application/problem+json',
      },
    });
  }
  const finishStatus = await drainRejectStream(rejectRes);
  if (finishStatus !== 'completed') {
    return Response.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        detail: `The reject step did not complete cleanly before modifying (run.finished status: ${finishStatus ?? 'none received'}). Not sending the modification.`,
      },
      { status: 502, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  return proxyAposSse(req, '/api/chat/stream', { thread_id, message });
}
