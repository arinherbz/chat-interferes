import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    threads: true,
    isolate: false,
    globals: true,
    include: ['server/__tests__/**/*.test.ts'],
  },
});
