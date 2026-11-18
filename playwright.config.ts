import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4175/credit-card-utilisation-management-simulator/";
const executablePath = process.env.SIMULATOR_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
    ...(executablePath ? [] : [{ name: "mobile-webkit", use: { ...devices["iPhone 13"] } }]),
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4175 --strictPort",
    url: baseURL,
  },
});
