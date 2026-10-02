import { test as base, expect } from '@playwright/test';
import { loadProfile, Runtime, selector } from './runtime';
import { loadCatalogue, titleId } from './catalogue';

const profile = loadProfile();
const catalogue = loadCatalogue();

export const test = base.extend<{ runtime: Runtime; sel: (key: string) => string; scenarioGate: void }>({
  // Every test title starts with a catalogue ID; capabilities come from the feature tags, never from the spec.
  scenarioGate: [async ({}, use, info) => {
    const id = titleId(info.title);
    const entry = id && catalogue.get(id);
    if (!entry) throw new Error(`test title must start with a known scenario ID: ${info.title}`);
    const missing = entry.caps.filter(c => !profile.capabilities.includes(c));
    info.skip(missing.length > 0, `capability-absent: ${missing.join(', ')}`);
    await use();
  }, { auto: true }],
  runtime: async ({}, use) => {
    const rt = Runtime.fromProfile(profile);
    await rt.ready();
    await use(rt);
  },
  sel: async ({}, use) => use((key: string) => selector(profile, key)),
});

export { expect };
