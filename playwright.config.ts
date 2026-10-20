import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(chrome) ? chrome : undefined) } },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }, { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3107", url: "http://127.0.0.1:3107", reuseExistingServer: false, timeout: 60000 },
});
