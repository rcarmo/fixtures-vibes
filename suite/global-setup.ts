/**
 * Lifecycle-managed runs: start the fixture model and the runtime from its profile, then expose
 * FIXTURES_BASE_URL / FIXTURES_MODEL_URL to the specs. External profiles skip all of this.
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
import { createServer } from 'node:net';
import { loadProfile } from './runtime';

const freePort = () => new Promise<number>((res, rej) => {
  const s = createServer(); s.unref(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = (s.address() as any).port; s.close(() => res(p)); });
});

async function waitFor(url: string, status: number, timeoutMs: number, label: string) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if ((await fetch(url)).status === status) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`${label} not ready: ${url}`);
}

export default async function globalSetup() {
  const profile = loadProfile();
  if (!profile.lifecycle) return;
  const root = mkdtempSync(join(tmpdir(), `fixtures-${profile.runtime}-`));
  const modelPort = await freePort();
  const port = await freePort();
  const modelUrl = `http://127.0.0.1:${modelPort}`;
  const env = {
    ...process.env, ...(profile.lifecycle.env ?? {}),
    FIXTURES_ROOT: root, FIXTURES_PORT: String(port),
    FIXTURE_MODEL_URL: `${modelUrl}/v1`, FIXTURE_MODEL_ID: 'fixture-1',
  };
  const log = (name: string) => openSync(join(root, `${name}.log`), 'a');
  const procs: ChildProcess[] = [];
  const model = spawn('bun', [resolve(here, '../control/fixture-model-server.ts')], {
    env: { ...env, FIXTURE_MODEL_PORT: String(modelPort), FIXTURE_MODEL_HOST: '127.0.0.1' }, stdio: ['ignore', log('model'), log('model')], detached: true,
  });
  procs.push(model);
  await waitFor(`${modelUrl}/control/health`, 200, 10_000, 'fixture model');
  execSync(profile.lifecycle.prepare, { cwd: profile.dir, env, stdio: ['ignore', log('prepare'), log('prepare')], shell: '/bin/sh' });
  const runtime = spawn('/bin/sh', ['-c', profile.lifecycle.start], { cwd: profile.dir, env, stdio: ['ignore', log('runtime'), log('runtime')], detached: true });
  procs.push(runtime);
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitFor(baseUrl + profile.readiness.path, profile.readiness.status ?? 200, profile.readiness.timeoutMs ?? 30_000, profile.runtime);
  process.env.FIXTURES_BASE_URL = baseUrl;
  process.env.FIXTURES_MODEL_URL = modelUrl;
  process.env.FIXTURES_RUN_ROOT = root;
  writeFileSync(join(root, 'run.json'), JSON.stringify({ baseUrl, modelUrl, pids: procs.map(p => p.pid) }));
  // Teardown: stop the runtime first, then the fixture model (never reset the model under a live runtime).
  return async () => {
    for (const p of [runtime, model]) {
      try { process.kill(-p.pid!, 'SIGTERM'); } catch {}
      await new Promise(r => setTimeout(r, 500));
      try { process.kill(-p.pid!, 'SIGKILL'); } catch {}
    }
  };
}
