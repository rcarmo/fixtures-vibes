// Root contract tests and Classic units have different source-relative fixtures.
// Pass explicit root files: `bun test tests` also recursively discovers Classic
// tests via their imports, then runs them under the wrong working directory.
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const profileArgs = process.env.FIXTURES_PROFILE_DIR
  ? ['--preload', resolve(dirname(fileURLToPath(import.meta.url)), '../mk/bun-test-profile.ts')]
  : [];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contracts = readdirSync(resolve(root, 'tests'))
  .filter(name => name.endsWith('.test.ts')).sort()
  .map(name => `./tests/${name}`);
if (!contracts.length) throw new Error('No root contract tests discovered');
for (const [cwd, files] of [[root, contracts], [resolve(root, 'ui/classic'), ['./tests/unit']]]) {
  const child = Bun.spawn([process.execPath, 'test', ...profileArgs, ...files], { cwd, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
  const code = await child.exited;
  if (code !== 0) process.exit(code);
}
