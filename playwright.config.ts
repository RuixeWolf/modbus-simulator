import { defineConfig, devices } from '@playwright/test'

const port = process.env.PORT || '5000'
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: `node scripts/dev.mjs --host 127.0.0.1 --port ${port} --tcp-host 127.0.0.1 --tcp-port 11502 --ready-output json --ready-timeout 30 --strict-ready`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      MODBUS_API_TOKEN: 'playwright-control-token',
      MODBUS_TCP_PORT: '11502',
      MODBUS_RTU_ENABLED: 'false'
    }
  }
})
