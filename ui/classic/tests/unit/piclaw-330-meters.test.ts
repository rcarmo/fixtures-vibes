import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as preact from '../../src/vendor/preact-htm-entry';
import { piclawModule } from './piclaw-module';
// git stores this vendor symlink as link text; use Classic's shared Preact instance in the test runtime.
mock.module(piclawModule('vendor/preact-htm.js'), () => preact);
const { buildCompactMetersSummary, shouldShowVram, resolveGpuMeterSnapshots } = await import(piclawModule('components/system-meters-hud.ts'));
const { normalizeGpuSnapshots, formatOptionalPercent } = await import(piclawModule('components/intel-gpu-meters.ts'));

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
