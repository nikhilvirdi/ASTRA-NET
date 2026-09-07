import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Web-side unit tests cover the pure presentation-logic modules in src/lib
// (semantic zoom, pass interpolation) — DOM-free, so the node environment
// suffices. Component/scene code is exercised by typecheck + live-browser
// verification, not jsdom.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@astranet/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
