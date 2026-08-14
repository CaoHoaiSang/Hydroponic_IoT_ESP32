import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } },
  webServer: { command: "node ../mqtt_backend/testSupport/startFrontendAcceptanceServer.js", cwd: process.cwd(), port: 4173, reuseExistingServer: false, timeout: 30_000 },
});
