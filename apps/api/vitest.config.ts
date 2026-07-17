import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/clients/**/*.ts',
        'src/poller/**/*.ts',
        'src/routes/**/*.ts',
        'src/brief/**/*.ts',
        'src/app.ts',
      ],
      exclude: [
        'src/clients/**/*.test.ts',
        'src/clients/**/index.ts',
        'src/clients/**/__fixtures__/**',
        'src/poller/**/*.test.ts',
        'src/routes/**/*.test.ts',
        'src/brief/**/*.test.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
