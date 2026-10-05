// bun test preload (mk/profiling.mk): CPU and heap capture for Bun 1.4's test runner, which has no --cpu-prof.
// JSC's profile() samples for the whole run (startSamplingProfiler crashes Bun 1.4.2); the global afterAll stops it,
// then writes the CPU samples and a heap snapshot (live objects at the end; JSC keeps no allocation history).
// Pattern from /workspace/exports/piclaw-nvml-pr-20261005/test-profile-preload.ts.
import { profile } from 'bun:jsc';
import { afterAll } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.FIXTURES_PROFILE_DIR;
if (base) {
  const dir = join(base, `bun-test-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const interval = Number(process.env.FIXTURES_BUN_SAMPLE_US) || 1000;
  writeFileSync(join(dir, 'command.json'), JSON.stringify({ argv: process.argv, sample_interval_us: interval }));
  let stop!: () => void;
  const finish = new Promise<void>(resolve => { stop = resolve; });
  const capture = profile(() => finish, interval);
  afterAll(async () => {
    stop();
    writeFileSync(join(dir, 'cpu.json'), JSON.stringify(await capture));
    writeFileSync(join(dir, 'heap.json'), JSON.stringify(Bun.generateHeapSnapshot()));
  }, 120_000);
}
