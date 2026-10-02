import { test as base, expect } from '@playwright/test';
import { loadProfile, Runtime, selector } from './runtime';

const profile = loadProfile();

export const test = base.extend<{ runtime: Runtime; sel: (key: string) => string }>({
  runtime: async ({}, use) => {
    const rt = Runtime.fromProfile(profile);
    await rt.ready();
    await use(rt);
  },
  sel: async ({}, use) => use((key: string) => selector(profile, key)),
});

/** Skip unless the runtime claims every capability the scenario requires. */
export function requires(runtime: Runtime, ...caps: string[]) {
  const missing = caps.filter(c => !runtime.has(c));
  test.skip(missing.length > 0, `capability-absent: ${missing.join(', ')}`);
}

export { expect };
