#!/usr/bin/env node
/**
 * Project-owned scratch root, resolved once (host policy, portable to CI):
 *   1. PROJECT_TMP_ROOT, if set: absolute, named after the project, owned, not a symlink — else fail;
 *   2. /workspace/tmp/<project> when /workspace/tmp exists;
 *   3. $RUNNER_TEMP/<project>, $TMPDIR/<project>, then the platform temp directory/<project>.
 * Layout: <root>/{cache/<tool>,build,runs/<purpose>/<run-id>}. Callers export the resolved PROJECT_TMP_ROOT to their
 * children, so a child that sees a run directory as TMPDIR does not resolve (and nest) again. Never removes files.
 *
 * CLI (node or bun): `project-tmp.mjs root` prints the root; `project-tmp.mjs init <purpose> <run-id>` also creates
 * the layout and prints the run directory. PROJECT_NAME names the project (default fixtures-vibes).
 */
import { existsSync, lstatSync, mkdirSync, statSync, accessSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const uid = () => (typeof process.getuid === 'function' ? process.getuid() : null);
const writable = (path) => { try { accessSync(path, constants.W_OK | constants.X_OK); return true; } catch { return false; } };

export function validProjectName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) && !/^[.-]/.test(name);
}

/** Absolute, normalised, no symlink on the path (the host's /workspace mount alias excepted); if it exists, an owned
 * writable directory; otherwise its nearest existing ancestor is a writable directory. */
export function usablePath(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || /(^|\/)\.\.?(\/|$)/.test(path)) return false;
  for (let p = path; p !== dirname(p); p = dirname(p)) {
    if (!existsSync(p) && !isLink(p)) continue;
    if (isLink(p) && !(p === '/workspace' && p !== path)) return false;
  }
  if (existsSync(path)) {
    const st = statSync(path);
    return st.isDirectory() && (uid() === null || st.uid === uid()) && writable(path);
  }
  let parent = path;
  while (!existsSync(parent)) parent = dirname(parent);
  return statSync(parent).isDirectory() && writable(parent);
}
function isLink(p) { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } }

export function resolveProjectTmpRoot(project = process.env.PROJECT_NAME || 'fixtures-vibes', env = process.env, workspaceBase = '/workspace/tmp') {
  if (!validProjectName(project)) throw new Error(`invalid canonical project name: ${project}`);
  if (env.PROJECT_TMP_ROOT !== undefined) {
    const root = env.PROJECT_TMP_ROOT.replace(/\/+$/, '');
    if (basename(root) !== project || !usablePath(root))
      throw new Error(`PROJECT_TMP_ROOT must be a usable absolute directory named ${project}, not a symlink: ${env.PROJECT_TMP_ROOT}`);
    return root;
  }
  const bases = [existsSync(workspaceBase) ? workspaceBase : '', env.RUNNER_TEMP, env.TMPDIR, tmpdir()];
  for (const base of bases) {
    if (!base) continue;
    const candidate = join(base, project);
    if (usablePath(candidate)) return candidate;
  }
  throw new Error('no writable project-owned temporary root available');
}

/** Create <root>/{cache,build,runs/<purpose>/<runId>/tmp}, checking each level, and return the run directory. */
export function initRunDir(root, purpose, runId) {
  if (!validProjectName(purpose) || !validProjectName(runId)) throw new Error(`invalid run purpose or id: ${purpose}/${runId}`);
  const run = join(root, 'runs', purpose, runId);
  for (const path of [root, join(root, 'cache'), join(root, 'build'), join(root, 'runs'), join(root, 'runs', purpose), run]) {
    if (!usablePath(path)) throw new Error(`unsafe scratch path: ${path}`);
    mkdirSync(path, { recursive: true });
  }
  mkdirSync(join(run, 'tmp'), { recursive: true });
  return run;
}

export const newRunId = () => `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${process.pid}`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [action = 'root', purpose, runId] = process.argv.slice(2);
    const root = resolveProjectTmpRoot();
    if (action === 'root') console.log(root);
    else if (action === 'init') console.log(initRunDir(root, purpose, runId));
    else throw new Error('usage: project-tmp.mjs root | init <purpose> <run-id>');
  } catch (e) {
    console.error(`project-tmp: ${e.message}`);
    process.exit(1);
  }
}
