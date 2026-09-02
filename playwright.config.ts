import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  use: {
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
  },
})
