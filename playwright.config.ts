import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Disabled for multi-user tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid state conflicts
  reporter: process.env.CI
    ? [["html"], ["junit", { outputFile: "test-results/junit.xml" }], ["list"]]
    : "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "REDIS_URL=redis://localhost:6379 pnpm run dev:server",
      url: "http://localhost:3001/health",
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm run dev",
      url: "http://localhost:5173",
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
