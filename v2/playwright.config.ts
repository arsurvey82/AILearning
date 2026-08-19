import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against the BUILT single file over file://, not the dev server.
 * That is deliberate: it proves the shipping artifact works with no server,
 * no build step and no network, which is what design-spec §8 asked for.
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
  },
});
