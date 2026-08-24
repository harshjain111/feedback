import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // sharp on a cold cache plus a full-resolution CLAHE pass is not fast.
    testTimeout: 30_000,
  },
})
