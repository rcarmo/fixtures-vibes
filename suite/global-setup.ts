/** Lifecycle profiles: start the shared fixture model once per run. Runtimes start per worker (see fixtures.ts). */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProfile } from './runtime';
import { removeRoot, startModel } from './lifecycle';

export default async function globalSetup() {
  const profile = loadProfile();
  if (!profile.lifecycle) return;
  const root = mkdtempSync(join(tmpdir(), `fixtures-model-${profile.runtime}-`));
  const model = await startModel(root);
  process.env.FIXTURES_MODEL_URL = model.url;
  process.env.FIXTURES_MODEL_PORT = String(model.port);
  process.env.FIXTURES_RUN_ROOT = root;
  return async () => { await model.stop(); removeRoot(root); };
}
