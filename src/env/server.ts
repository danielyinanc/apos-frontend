import 'server-only';
import { z } from 'zod';

const DEV_TOKEN_SENTINEL = 'dev-insecure-token';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APOS_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  BACKEND_URL: z.string().url(),
  APOS_API_TOKEN: z.string().min(1),
  APOS_BACKEND_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type ServerEnv = Readonly<z.infer<typeof schema>>;

export class EnvironmentError extends Error {
  override readonly name = 'EnvironmentError';
}

let cached: ServerEnv | undefined;

/**
 * Fail fast on misconfiguration, mirroring apos-backend's
 * assert_production_safe(): refuse to serve outside dev with a placeholder
 * secret rather than starting and returning 401s to every request.
 */
export function assertServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new EnvironmentError(`Invalid server environment:\n${issues}`);
  }

  const env = parsed.data;

  if (env.APOS_ENV !== 'dev' && env.APOS_API_TOKEN === DEV_TOKEN_SENTINEL) {
    throw new EnvironmentError(
      `APOS_API_TOKEN is the development placeholder but APOS_ENV=${env.APOS_ENV}. Refusing to start.`,
    );
  }
  if (env.APOS_ENV !== 'dev' && new URL(env.BACKEND_URL).protocol !== 'https:') {
    throw new EnvironmentError(
      `BACKEND_URL must be https outside dev (APOS_ENV=${env.APOS_ENV}); the bearer token would otherwise cross the wire in clear text.`,
    );
  }

  cached = Object.freeze(env);
  return cached;
}

export const serverEnv = (): ServerEnv => assertServerEnv();
