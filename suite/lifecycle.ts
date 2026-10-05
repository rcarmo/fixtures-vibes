/**
 * Process lifecycle for lifecycle-managed profiles. The fixture model is started once per run (global setup);
 * the runtime is started per Playwright worker, so a failed test (which replaces the worker) gets a fresh runtime.
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import type { Profile } from './runtime';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * A fresh scratch root for the model or one runtime, with its own `tmp/`. Roots go under FIXTURES_RUN_ROOT, which the
 * Makefiles set to the project's run directory (mk/project-paths.mk), else under the OS temp directory (TMPDIR).
 * FIXTURES_RUN_ROOT must be an absolute, real directory owned by this user.
 */
export function newRoot(prefix: string) {
  const base = process.env.FIXTURES_RUN_ROOT;
  if (base) {
    if (!isAbsolute(base)) throw new Error(`FIXTURES_RUN_ROOT must be absolute: ${base}`);
    mkdirSync(base, { recursive: true });
    const st = lstatSync(base);
    if (st.isSymbolicLink() || !st.isDirectory() || (process.getuid && st.uid !== process.getuid()))
      throw new Error(`FIXTURES_RUN_ROOT must be a directory owned by this user, not a symlink: ${base}`);
  }
  const root = mkdtempSync(join(base || tmpdir(), prefix));
  mkdirSync(join(root, 'tmp'));
  return root;
}

export const freePort = () => new Promise<number>((res, rej) => {
  const s = createServer(); s.unref(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = (s.address() as any).port; s.close(() => res(p)); });
});

export async function waitFor(url: string, status: number, timeoutMs: number, label: string) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if ((await fetch(url)).status === status) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`${label} not ready: ${url}`);
}

async function stopGroup(p: ChildProcess) {
  try { process.kill(-p.pid!, 'SIGTERM'); } catch {}
  await new Promise(r => setTimeout(r, 500));
  try { process.kill(-p.pid!, 'SIGKILL'); } catch {}
}

export async function startModel(root: string) {
  const port = await freePort();
  const log = openSync(join(root, 'model.log'), 'a');
  const proc = spawn('bun', [resolve(here, '../control/fixture-model-server.ts')], {
    env: { ...process.env, ...tmpEnv(root), FIXTURE_MODEL_PORT: String(port), FIXTURE_MODEL_HOST: '::' }, stdio: ['ignore', log, log], detached: true,
  });
  const url = `http://127.0.0.1:${port}`;
  await waitFor(`${url}/control/health`, 200, 10_000, 'fixture model');
  return { url, port, stop: () => stopGroup(proc) };
}

const tmpEnv = (root: string) => { const tmp = join(root, 'tmp'); return { TMPDIR: tmp, TMP: tmp, TEMP: tmp }; };

/** prepare → start → readiness, in a fresh FIXTURES_ROOT whose `tmp/` is the runtime's TMPDIR. */
export async function startRuntime(profile: Profile & { dir: string }, modelUrl: string, modelPort: number) {
  const lc = profile.lifecycle!;
  const root = newRoot(`fixtures-${profile.runtime}-`);
  const port = await freePort();
  const env = {
    ...process.env, ...tmpEnv(root), ...(lc.env ?? {}),
    FIXTURES_ROOT: root, FIXTURES_PORT: String(port),
    FIXTURE_MODEL_URL: `${modelUrl}/v1`, FIXTURE_MODEL_ID: 'fixture-1',
    // Same server under a non-loopback-looking name, for runtimes that shrink tools/prompts for local model URLs.
    FIXTURE_MODEL_NAMED_URL: `http://fixture-model.localhost:${modelPort}/v1`,
  };
  const log = (name: string) => openSync(join(root, `${name}.log`), 'a');
  try {
    execSync(lc.prepare, { cwd: profile.dir, env, stdio: ['ignore', log('prepare'), log('prepare')], shell: '/bin/sh' });
  } catch (e) {
    const tail = readTail(join(root, 'prepare.log'));
    removeRoot(root);
    throw new Error(`${profile.runtime} prepare failed${tail ? `\nprepare.log (tail):\n${tail}` : ''}`);
  }
  const proc = spawn('/bin/sh', ['-c', lc.start], { cwd: profile.dir, env, stdio: ['ignore', log('runtime'), log('runtime')], detached: true });
  const baseUrl = `http://127.0.0.1:${port}`;
  const { path, status = 200, timeoutMs = 30_000 } = profile.readiness;
  try {
    await waitFor(baseUrl + path, status, timeoutMs, profile.runtime);
  } catch (e) {
    await stopGroup(proc);
    const tail = readTail(join(root, 'runtime.log'));
    removeRoot(root);
    throw new Error(`${(e as Error).message}${tail ? `\nruntime.log (tail):\n${tail}` : ''}`);
  }
  return { baseUrl, root, stop: async () => { await stopGroup(proc); removeRoot(root); } };
}

function readTail(file: string, bytes = 4096) {
  try { return readFileSync(file, 'utf8').slice(-bytes); } catch { return ''; }
}

/** A run root is scratch (runtime DB, workspace, home, logs): remove it once its process has stopped.
 * FIXTURES_KEEP_ROOTS=1 keeps roots for debugging. */
export function removeRoot(root: string) {
  if (process.env.FIXTURES_KEEP_ROOTS === '1') return;
  rmSync(root, { recursive: true, force: true, maxRetries: 3 });
}
