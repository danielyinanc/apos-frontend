import { threadStore } from '@/lib/server/thread-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Local-only thread list. apos-backend has no thread-list endpoint at all --
 * threads exist only in the LangGraph checkpointer with no HTTP read path.
 * This reflects only what this BFF process has observed streaming past it.
 */
export function GET(): Response {
  return Response.json({ threads: threadStore.list() });
}
