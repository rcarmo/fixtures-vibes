// bun test preload (mk/profiling.mk): Bun 1.4's test runner has no CPU/heap profiler, so record JSC's live-heap
// statistics at exit next to the run's other profiles. Not an allocation profile; see mk/profiling.mk.
import { afterAll } from 'bun:test';
import { heapStats } from 'bun:jsc';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.FIXTURES_PROFILE_DIR;
if (dir) afterAll(() => {
  const h = heapStats();
  const top = Object.entries(h.objectTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  writeFileSync(join(dir, `bun-test-heap-${process.pid}.json`), JSON.stringify({
    heapSize: h.heapSize, heapCapacity: h.heapCapacity, extraMemorySize: h.extraMemorySize, objectCount: h.objectCount,
    protectedObjectCount: h.protectedObjectCount, topObjectTypes: top,
  }, null, 1));
});
