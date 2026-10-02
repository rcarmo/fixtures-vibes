import { test, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const root = join(import.meta.dir, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const newAjv = () => { const a = new Ajv2020({ allErrors: true, strict: false }); addFormats(a); return a; };
const ajv = newAjv();
const compile = (p: string) => newAjv().compile(read(p));

const capabilities = read('capabilities.json').capabilities as Record<string, unknown>;

test('every schema compiles', () => {
  for (const f of readdirSync(join(root, 'schemas'))) expect(() => compile(`schemas/${f}`)).not.toThrow();
});

test('reference profiles and skips files are valid and only claim known capabilities', () => {
  const validate = compile('schemas/runtime-profile.schema.json');
  const validateSkips = compile('schemas/skips.schema.json');
  for (const f of readdirSync(join(root, 'profiles'))) {
    if (f.endsWith('-skips.json')) {
      expect(validateSkips(read(`profiles/${f}`)), `${f}: ${ajv.errorsText(validateSkips.errors)}`).toBe(true);
      continue;
    }
    const profile = read(`profiles/${f}`);
    expect(validate(profile), `${f}: ${ajv.errorsText(validate.errors)}`).toBe(true);
    for (const cap of profile.capabilities) expect(capabilities[cap], `${f} claims unknown ${cap}`).toBeDefined();
  }
});

test('capability names follow the @cap- convention', () => {
  for (const name of Object.keys(capabilities)) expect(name).toMatch(/^@cap-[a-z0-9-]+$/);
});

test('skips schema enforces reason-specific fields', () => {
  const validate = compile('schemas/skips.schema.json');
  const base = { runtime: 'x', fixturesVibes: 'v0.1.0' };
  expect(validate({ ...base, skips: [{ id: '@ux-original-016', reason: 'capability-absent', capability: '@cap-queue', detail: 'Queue is not implemented here.' }] })).toBe(true);
  expect(validate({ ...base, skips: [{ id: '@ux-original-016', reason: 'capability-absent', detail: 'Missing the capability field.' }] })).toBe(false);
  expect(validate({ ...base, skips: [{ id: '@ux-original-016', reason: 'known-defect', detail: 'Failing without an issue link.' }] })).toBe(false);
  expect(validate({ ...base, skips: [{ id: '@ux-original-016', reason: 'intentional-divergence', detail: 'Missing sign-off on purpose.' }] })).toBe(false);
});

// Fixture model behaviour, exercised over HTTP on a private port.
let proc: ReturnType<typeof Bun.spawn>;
const port = 39000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;

beforeAll(async () => {
  proc = Bun.spawn(['bun', join(root, 'control/fixture-model-server.ts')], { env: { ...process.env, FIXTURE_MODEL_PORT: String(port) }, stdout: 'ignore', stderr: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${base}/control/health`)).ok) return; } catch {} await Bun.sleep(100); }
  throw new Error('fixture model did not start');
});
afterAll(() => proc?.kill());

const chat = (content: string, extra: Record<string, unknown> = {}) => fetch(`${base}/v1/chat/completions`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'fixture-1', messages: [{ role: 'user', content }], ...extra }),
});

test('default reply echoes only the last prompt line', async () => {
  const r = await (await chat('Channel: web\n\nhello there')).json();
  expect(r.choices[0].message.content).toBe('Fixture reply: hello there');
});

test('reply, newline escape and usage directives', async () => {
  const r = await (await chat('[reply:a\\nb][usage:1234] x')).json();
  expect(r.choices[0].message.content).toBe('a\nb');
  expect(r.usage.prompt_tokens).toBe(1234);
});

test('streamed script orders reasoning, gate and content', async () => {
  const res = await chat('[think:hmm][gate:t1][say:after] go', { stream: true });
  const reader = res.body!.getReader();
  let head = '';
  while (!head.includes('reasoning_content')) head += new TextDecoder().decode((await reader.read()).value);
  expect(head).toContain('"role":"assistant"');
  expect(head).toContain('"reasoning_content":"hmm"');
  expect(head).not.toContain('"content":"after"');
  expect((await (await fetch(`${base}/control/gates`)).json()).t1.waiting).toBe(1);
  await fetch(`${base}/control/gates/t1/open`, { method: 'POST' });
  let rest = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; rest += new TextDecoder().decode(value); }
  expect(rest).toContain('"content":"after"');
  expect(rest).toContain('[DONE]');
});

test('tool call then after-tool reply', async () => {
  const first = await (await chat('[tool:read {"path":"README.md"}][after-tool:DONE] go')).json();
  expect(first.choices[0].finish_reason).toBe('tool_calls');
  expect(first.choices[0].message.tool_calls[0].function).toEqual({ name: 'read', arguments: '{"path":"README.md"}' });
  const second = await (await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'fixture-1', messages: [
      { role: 'user', content: '[tool:read {"path":"README.md"}][after-tool:DONE] go' },
      { role: 'assistant', content: null, tool_calls: first.choices[0].message.tool_calls },
      { role: 'tool', tool_call_id: first.choices[0].message.tool_calls[0].id, content: 'file text' },
    ] }),
  })).json();
  expect(second.choices[0].message.content).toBe('DONE');
});

test('fail directive and reset failing held requests', async () => {
  expect((await chat('[fail:503] x')).status).toBe(503);
  const held = chat('[gate:t2] x');
  await Bun.sleep(100);
  await fetch(`${base}/control/reset`, { method: 'POST' });
  expect((await held).status).toBe(499);
  expect(await (await fetch(`${base}/control/log`)).json()).toEqual([]);
  expect(await (await fetch(`${base}/control/gates`)).json()).toEqual({});
});
