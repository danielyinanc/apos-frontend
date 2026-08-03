export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertServerEnv } = await import('@/env/server');
  try {
    const env = assertServerEnv();
    console.log(`apos-frontend starting: APOS_ENV=${env.APOS_ENV} backend=${env.BACKEND_URL}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
