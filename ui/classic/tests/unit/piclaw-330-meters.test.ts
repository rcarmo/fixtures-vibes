import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { piclawModule } from './piclaw-module';
import { piclawWebAdapter } from '../../scripts/piclaw-web.mjs';

// Exercise the build adapter rather than Bun's runtime module/mock resolver:
// vendored link-pointer files are data, not executable JavaScript.
const root = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
async function adaptedModule(path: string) {
  const result = await Bun.build({ entrypoints: [piclawModule(path)], target: 'bun',
    plugins: [{ name: 'meter-preact-entry', setup(build) {
      build.onResolve({filter: /preact-htm\.js$/}, () => ({path: `${root}/src/vendor/preact-htm-entry.ts`}));
    }}, piclawWebAdapter(root)] });
  if (!result.success) throw new AggregateError(result.logs, 'meter adapter build failed');
  return import(`data:text/javascript;base64,${Buffer.from(await result.outputs[0].text()).toString('base64')}`);
}
const { buildCompactMetersSummary, shouldShowVram, resolveGpuMeterSnapshots } = await adaptedModule('components/system-meters-hud.ts');
const { normalizeGpuSnapshots, formatOptionalPercent } = await adaptedModule('components/intel-gpu-meters.ts');

test('3.3.0 meter integration omits unavailable telemetry instead of reporting zero', () => {
  expect(buildCompactMetersSummary({ cpu_percent: null, ram_percent: undefined })).toBe('');
  expect(buildCompactMetersSummary({ cpu_percent: 0, ram_percent: 20 })).toBe('CPU 0% • RAM 20%');
  for (const invalid of [null, undefined, '', true, -1, 101, NaN]) expect(formatOptionalPercent(invalid)).toBe('—');
});

test('generic GPU snapshots filter disabled devices and preserve memory-only telemetry', () => {
  const devices = normalizeGpuSnapshots([
    { id: 'disabled', provider: 'nvml', disabled: true },
    { id: 'nvidia', provider: 'nvml', status: 'ok', sample_time_ms: 1000, memory: { used_bytes: 512, total_bytes: 1024 } },
  ], { nowMs: 1000 });
  expect(devices).toHaveLength(1);
  expect(devices[0].id).toBe('nvidia');
  const metrics = { gpu_provider: 'device-memory', vram_percent: 50, vram_total_bytes: 1024, vram_used_bytes: 512, vram_series: [25, 50], gpus: [] };
  expect(shouldShowVram(metrics)).toBe(true);
  expect(resolveGpuMeterSnapshots(metrics)).toHaveLength(1);
  expect(resolveGpuMeterSnapshots({ ...metrics, vram_used_bytes: 2048 })).toHaveLength(0);
});

test('tagged picker section headings use normal positioning', () => {
  const css = readFileSync(piclawModule('styles/app.css').replace('/src/styles/app.css', '/static/classic/css/chat.css'), 'utf8');
  for (const name of ['compose-session-section-heading', 'compose-model-catalogue-section-heading']) {
    const rule = css.match(new RegExp(`\\.${name} \\{([^}]+)\\}`))?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain('position: relative');
    expect(rule).not.toContain('position: sticky');
  }
});
