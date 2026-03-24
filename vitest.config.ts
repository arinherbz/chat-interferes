import path from "path";
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    environment: 'node',
    threads: true,
    isolate: false,
    globals: true,
    include: ['server/__tests__/**/*.test.ts'],
  },
});
