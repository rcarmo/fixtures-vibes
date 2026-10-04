import { test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { generateMessages } from '@cucumber/gherkin';
import { IdGenerator, SourceMediaType } from '@cucumber/messages';

const root = join(import.meta.dir, '..');
const caps = JSON.parse(readFileSync(join(root, 'capabilities.json'), 'utf8')).capabilities;
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = join(d, e.name);
  return e.isDirectory() ? files(p) : e.name.endsWith('.feature') ? [p] : [];
}).sort();

type Scenario = { id: string | null; ids: string[]; tags: string[]; name: string; uri: string; line: number };
const scenarios: Scenario[] = [];
const parseErrors: string[] = [];
for (const path of files(join(root, 'features'))) {
  const uri = relative(root, path);
  const msgs = generateMessages(readFileSync(path, 'utf8'), uri, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, {
    newId: IdGenerator.incrementing(), includeSource: false, includeGherkinDocument: true, includePickles: false,
  });
  for (const m of msgs) if (m.parseError) parseErrors.push(`${uri}: ${m.parseError.message}`);
  const doc = msgs.find(m => m.gherkinDocument)?.gherkinDocument;
  const walk = (children: any[]) => children.forEach(c => {
    if (c.scenario) {
      const tags = c.scenario.tags.map((t: any) => t.name);
      const ids = tags.filter((t: string) => /^@ux-[a-z-]+-\d{3}$/.test(t));
      scenarios.push({ id: ids[0] ?? null, ids, tags, name: c.scenario.name, uri, line: c.scenario.location.line });
    }
    if (c.rule) walk(c.rule.children);
  });
  if (doc?.feature) walk(doc.feature.children);
}

test('all features parse as Gherkin', () => expect(parseErrors).toEqual([]));

test('every scenario has exactly one stable ID and IDs are unique', () => {
  const bad = scenarios.filter(s => s.ids.length !== 1).map(s => `${s.uri}:${s.line}`);
  expect(bad).toEqual([]);
  const seen = new Map<string, string>();
  const dup: string[] = [];
  for (const s of scenarios) { if (seen.has(s.id!)) dup.push(`${s.id} ${seen.get(s.id!)} ${s.uri}:${s.line}`); seen.set(s.id!, `${s.uri}:${s.line}`); }
  expect(dup).toEqual([]);
});

test('capability tags are declared in capabilities.json', () => {
  const unknown = [...new Set(scenarios.flatMap(s => s.tags.filter(t => t.startsWith('@cap-') && !caps[t])))];
  expect(unknown).toEqual([]);
});

test('features name no runtime and no runtime repository path', () => {
  const hits: string[] = [];
  for (const path of files(join(root, 'features'))) {
    readFileSync(path, 'utf8').split('\n').forEach((l, i) => { if (/\b(Gi|Vibes|Tau|tau-prime)\b|(features|tests)\/ux\/|docs\/(internal|reviews|design)\//.test(l)) hits.push(`${relative(root, path)}:${i + 1}`); });
  }
  expect(hits).toEqual([]);
});

test('shared ID map covers every Gi positional ID once', () => {
  const map = JSON.parse(readFileSync(join(root, 'features/canonical/shared-id-map.json'), 'utf8')).map as { giPositional: string; id: string }[];
  const ids = new Set(scenarios.map(s => s.id));
  expect(new Set(map.map(m => m.giPositional)).size).toBe(map.length);
  for (const m of map) expect(ids.has(m.id)).toBe(true);
});

test('catalogue counts are stable', () => {
  expect(scenarios.filter(s => s.id!.startsWith('@ux-shared-')).length).toBe(33);
  expect(scenarios.filter(s => !s.id!.startsWith('@ux-shared-')).length).toBe(282);
});
