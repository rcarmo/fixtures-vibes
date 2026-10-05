/** Lifecycle profiles: start the shared fixture model once per run. Runtimes start per worker (see fixtures.ts). */
import { loadProfile } from './runtime';
import { newRoot, removeRoot, runRoot, startModel } from './lifecycle';

export default async function globalSetup() {
  runRoot(); // resolved once here, so workers, browsers and runtimes share the run directory
  const profile = loadProfile();
  if (!profile.lifecycle) return;
  const root = newRoot(`fixtures-model-${profile.runtime}-`);
  const model = await startModel(root);
  process.env.FIXTURES_MODEL_URL = model.url;
  process.env.FIXTURES_MODEL_PORT = String(model.port);
  return async () => { await model.stop(); removeRoot(root); };
}
