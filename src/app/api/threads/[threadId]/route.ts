import { threadStore } from '@/lib/server/thread-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
): Promise<Response> {
  const { threadId } = await params;
  const record = threadStore.get(threadId);
  if (!record) {
    return Response.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `thread ${threadId} is unknown to this frontend instance`,
      },
      { status: 404, headers: { 'content-type': 'application/problem+json' } },
    );
  }
  return Response.json(record);
}
