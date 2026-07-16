import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 120_000,
  // Phaser/WebGL contexts are intentionally serialized on the Windows classroom-dev machine.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4287',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4287',
    url: 'http://127.0.0.1:4287',
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_ENABLE_DEMO_MODE: 'true',
      VITE_FORCE_CANVAS: 'true',
    },
  },
  projects: [
    { name: 'ipad-portrait', use: { ...devices['iPad (gen 7)'] } },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 7) landscape'] } },
    { name: 'chromebook', use: { viewport: { width: 1366, height: 768 } } },
  ],
})
