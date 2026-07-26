import { defineConfig } from 'vitest/config';

// Web-side unit tests cover the pure presentation-logic modules in src/lib
// (semantic zoom, pass interpolation) — DOM-free, so the node environment
// suffices. Component/scene code is exercised by typecheck + live-browser
// verification, not jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
