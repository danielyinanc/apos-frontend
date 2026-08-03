import 'server-only';
import { z } from 'zod';
import { serverEnv } from '@/env/server';
import { proxyAposSse } from '@/lib/server/proxy-sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ModifyRequestSchema = z.object({
  thread_id: z.string(),
  interrupt_id: z.string(),
  message: z.string().min(1),
});

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
  // Drain the reject SSE body before starting the follow-up chat stream.
  await rejectRes.body?.cancel();

  return proxyAposSse(req, '/api/chat/stream', { thread_id, message });
}
