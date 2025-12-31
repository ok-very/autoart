import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include test files
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],

    // Global test setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/db/migrations/**',
        'src/db/seeds/**',
        'src/index.ts',
      ],
    },

    // Test timeout
    testTimeout: 30000,

    // Run tests sequentially for database tests
    fileParallelism: false,

    // Sequence tests (important for database tests)
    sequence: {
      shuffle: false,
    },
  },
});
