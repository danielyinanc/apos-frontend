import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Explicit `projects` avoids ambiguity now that the repo has three
  // tsconfig files (app, tests, scripts) -- without it, vite-tsconfig-paths'
  // auto-discovery can nondeterministically resolve a test file against
  // tsconfig.scripts.json (no `paths`), breaking the `@/*` alias.
  plugins: [tsconfigPaths({ projects: ['./tsconfig.tests.json'] }), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', '.next/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**', 'scripts/**'],
      exclude: ['src/types/**', 'src/app/**/layout.tsx'],
    },
  },
});
