import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: { include: ['src/domain/**'], reporter: ['text', 'lcov'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
