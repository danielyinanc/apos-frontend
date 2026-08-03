import { z } from 'zod';
import { proxyAposSse } from '@/lib/server/proxy-sse';
import { threadStore } from '@/lib/server/thread-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  thread_id: z.string().optional(),
  plan: z.array(z.record(z.string(), z.unknown())).optional(),
  portfolio_id: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = ChatRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { type: 'about:blank', title: 'Bad Request', status: 400, detail: parsed.error.message },
      { status: 400, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  const body = parsed.data;
  if (body.thread_id) {
    threadStore.touch(body.thread_id, {
      title: body.message.slice(0, 80),
      lastRunId: undefined,
    });
  }

  return proxyAposSse(req, '/api/chat/stream', body);
}
