/** Scenario catalogue parsed from features/: ID → name, file and @cap-* requirements. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMessages } from '@cucumber/gherkin';
import { IdGenerator, SourceMediaType } from '@cucumber/messages';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ID_PATTERN = /^@ux-[a-z-]+-\d{3}$/;
export type CatalogueEntry = { name: string; uri: string; caps: string[] };

const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = join(d, e.name); return e.isDirectory() ? files(p) : e.name.endsWith('.feature') ? [p] : [];
});

export function loadCatalogue(root = repoRoot): Map<string, CatalogueEntry> {
  const out = new Map<string, CatalogueEntry>();
  for (const p of files(join(root, 'features')).sort()) {
    const uri = relative(root, p);
    const doc = generateMessages(readFileSync(p, 'utf8'), uri, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,
      { newId: IdGenerator.incrementing(), includeSource: false, includeGherkinDocument: true, includePickles: false })
      .find(m => m.gherkinDocument)?.gherkinDocument;
    const walk = (cs: any[]) => cs.forEach(c => {
      if (c.scenario) {
        const tags: string[] = c.scenario.tags.map((t: any) => t.name);
        const id = tags.find(t => ID_PATTERN.test(t));
        if (id) out.set(id, { name: c.scenario.name, uri, caps: tags.filter(t => t.startsWith('@cap-')) });
      }
      if (c.rule) walk(c.rule.children);
    });
    if (doc?.feature) walk(doc.feature.children);
  }
  return out;
}

export const titleId = (title: string) => title.match(/^(@ux-[a-z-]+-\d{3})\b/)?.[1];
