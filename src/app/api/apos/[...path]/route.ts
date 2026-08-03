import 'server-only';
import { serverEnv } from '@/env/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Whitelist: only the backend's GET read routes are reachable through this
// proxy. This is not an open passthrough -- unlisted paths 404.
const ALLOWED_PATHS = new Set([
  'packs/active',
  'portfolio/snapshot',
  'regime/current',
  'risk/measures',
  'healthz',
]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const joined = path.join('/');
  if (!ALLOWED_PATHS.has(joined)) {
    return Response.json(
      { type: 'about:blank', title: 'Not Found', status: 404, detail: `Unknown route: ${joined}` },
      { status: 404, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  const env = serverEnv();
  const upstreamPath = joined === 'healthz' ? '/healthz' : `/api/${joined}`;
  const upstream = await fetch(new URL(upstreamPath, env.BACKEND_URL), {
    headers: { authorization: `Bearer ${env.APOS_API_TOKEN}` },
    cache: 'no-store',
    signal: req.signal,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
