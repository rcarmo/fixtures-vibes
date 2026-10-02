import { defineConfig, devices } from '@playwright/test';

// One shared configuration for every runtime: same browsers, viewports and zero retries.
const viewports = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};

export default defineConfig({
  testDir: './specs',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: '../test-results/compliance.json' }]],
  outputDir: '../test-results/artifacts',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: (['chromium', 'webkit'] as const).flatMap(browser =>
    Object.entries(viewports).map(([size, v]) => ({
      name: `${browser}-${size}`,
      use: { ...devices[browser === 'chromium' ? 'Desktop Chrome' : 'Desktop Safari'], ...v, browserName: browser },
    }))),
});
