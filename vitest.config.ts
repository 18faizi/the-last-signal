import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/unit/**/*.test.ts', 'src/systems/**/*.test.ts'],
    // jsdom provides window/document for input-manager and DOM-adjacent
    // tests; pure logic tests run in it without issue.
    environment: 'jsdom',
    restoreMocks: true,
  },
});
