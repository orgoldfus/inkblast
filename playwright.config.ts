import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:4174/inkblast/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1080 },
      },
    },
  ],
  webServer: {
    command:
      "npm run build -- --base=/inkblast/ --outDir=/tmp/inkblast-browser-tests --emptyOutDir && npm run preview -- --port 4174 --strictPort --base=/inkblast/ --outDir=/tmp/inkblast-browser-tests",
    url: "http://127.0.0.1:4174/inkblast/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
