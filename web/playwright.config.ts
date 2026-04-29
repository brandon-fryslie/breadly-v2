import { defineConfig, devices } from "@playwright/test";

// Test config talks to a locally-running dev server on :3000.
// `webServer` here would clash with a dev server you've already started, so
// we leave the user to run `npm run dev` and expect :3000. Clerk creds are
// read from .clerk/.tmp/keyless.json in tests/global-setup.ts.

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
