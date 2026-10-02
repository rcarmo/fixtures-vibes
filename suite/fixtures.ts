import { test as base, expect } from '@playwright/test';
import { loadProfile, Runtime, selector } from './runtime';
import { startRuntime } from './lifecycle';
import { loadCatalogue, titleId } from './catalogue';

const profile = loadProfile();
const catalogue = loadCatalogue();

export const test = base.extend<{ runtime: Runtime; sel: (key: string) => string; scenarioGate: void }, { server: { baseUrl: string } }>({
  // Lifecycle runtimes start per worker; Playwright replaces the worker after a failure, so the next test gets a fresh runtime.
  server: [async ({}, use) => {
    if (!profile.lifecycle) { await use({ baseUrl: profile.external!.baseUrl }); return; }
    const rt = await startRuntime(profile, process.env.FIXTURES_MODEL_URL!, Number(process.env.FIXTURES_MODEL_PORT));
    await use({ baseUrl: rt.baseUrl });
    await rt.stop();
  }, { scope: 'worker' }],
  // Every test title starts with a catalogue ID; capabilities come from the feature tags, never from the spec.
  scenarioGate: [async ({}, use, info) => {
    const id = titleId(info.title);
    const entry = id && catalogue.get(id);
    if (!entry) throw new Error(`test title must start with a known scenario ID: ${info.title}`);
    const missing = entry.caps.filter(c => !profile.capabilities.includes(c));
    info.skip(missing.length > 0, `capability-absent: ${missing.join(', ')}`);
    await use();
  }, { auto: true }],
  // Opt-in: runtimes that always ask before running a tool get the approval clicked for fixture tool calls.
  page: async ({ page }, use) => {
    // Runtimes may rate-limit writes (Piclaw 3.2.5: 30 agent messages per sliding minute, no Retry-After). Rate limits
    // are not under test, so a write answered with HTTP 429 is retried with backoff; any other answer passes through.
    // Registered first, so spec-level request control (suite/net.ts) runs before it and falls back to it.
    await page.route('**/*', async route => {
      if (route.request().method() === 'GET') return route.fallback();
      let response = await route.fetch();
      for (const delay of [2000, 4000, 8000, 8000, 8000]) {
        if (response.status() !== 429) break;
        const retryAfter = Number(response.headers()['retry-after']) * 1000;
        await new Promise(r => setTimeout(r, retryAfter > 0 ? Math.min(retryAfter, 30_000) : delay));
        response = await route.fetch();
      }
      await route.fulfill({ response });
    });
    if (profile.approval) {
      const approve = page.getByRole('button', { name: new RegExp(profile.approval.button) });
      await page.addLocatorHandler(approve, async b => { await b.click(); }, { noWaitAfter: true });
    }
    await use(page);
    // A write may still be in flight when the test ends; drop handlers without failing the test.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  },
  runtime: async ({ server }, use) => {
    const rt = Runtime.fromProfile(profile, server.baseUrl);
    await rt.ready();
    await use(rt);
    // Isolation: a failed test must not leave held turns or an outage behind for the next one.
    await rt.releaseAll();
  },
  sel: async ({}, use) => use((key: string) => selector(profile, key)),
});

export { expect };
