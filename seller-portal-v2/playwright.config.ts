import { defineConfig, devices } from '@playwright/test';

// NOTE: For full end-to-end coverage (real auth, real data flows like
// login -> create product -> fulfill order), the backend service must
// be running separately on port 3000. This config only boots the
// Next.js dev server on port 3001. Tests that exercise authenticated
// flows will fail unless the backend is available.
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm run dev',
    port: 3001,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
