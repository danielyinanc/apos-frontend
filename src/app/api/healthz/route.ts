import { readFileSync } from 'node:fs';
import path from 'node:path';
import { serverEnv } from '@/env/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readPinnedBackend(): string {
  try {
    return readFileSync(path.join(process.cwd(), 'backend-version.txt'), 'utf8').trim();
  } catch {
    return 'unknown';
  }
}

export function GET(): Response {
  const env = serverEnv();
  return Response.json({
    status: 'ok',
    version: process.env.APOS_BUILD_VERSION ?? 'dev',
    backend: { url: env.BACKEND_URL, pinned: readPinnedBackend() },
  });
}
