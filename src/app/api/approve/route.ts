import { z } from 'zod';
import { proxyAposSse } from '@/lib/server/proxy-sse';
import { threadStore } from '@/lib/server/thread-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ApproveRequestSchema = z.object({
  thread_id: z.string(),
  interrupt_id: z.string(),
  action: z.enum(['approve', 'reject']),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = ApproveRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { type: 'about:blank', title: 'Bad Request', status: 400, detail: parsed.error.message },
      { status: 400, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  const body = parsed.data;
  const response = await proxyAposSse(req, '/api/approve', body);
  if (response.ok) {
    threadStore.clearPendingInterrupt(body.thread_id);
  }
  return response;
}
