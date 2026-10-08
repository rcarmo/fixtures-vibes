import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { patchEditorRevision, patchEditorLoaderRevision } from '../../scripts/patch-editor-revision.mjs';

// Exercise the real proxy, not a stand-in that already forwards the revision.
function loader(source: string): any {
  const patched = source.replace('class LazyEditorInstance', 'export class LazyEditorInstance');
  const js = new Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(patched);
  const isolated = js.replace(/^import .*;\n/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', JSON.stringify('https://test.invalid/editor-loader.js'));
  return new Function(`${isolated}\nreturn LazyEditorInstance;`)();
}
const source = readFileSync(new URL('../../piclaw/web-3.3.0/web/src/panes/editor-loader.ts', import.meta.url), 'utf8');

test('lazy proxy forwards exact revision to real editor, including zero', () => {
  const Lazy = loader(patchEditorLoaderRevision(source));
  const proxy = Object.create(Lazy.prototype);
  const calls: any[] = [];
  proxy.real = { setContent: (...args: any[]) => calls.push(args) };
  for (const revision of ['opaque', 0, 23, undefined]) proxy.setContent('text', 'mtime', revision);
  expect(calls).toEqual(['opaque', 0, 23, undefined].map(revision => ['text', 'mtime', revision]));
});

test('loader patch fails on missing or duplicate anchors', () => {
  expect(() => patchEditorLoaderRevision('drift')).toThrow();
  expect(() => patchEditorLoaderRevision(source + source)).toThrow();
});

test('actual proxy refresh updates adapted editor baseline and invalid refresh locks writes', () => {
  const realSource = patchEditorRevision(readFileSync(new URL('../../piclaw/web-3.3.0/extensions/viewers/editor/editor-extension.ts', import.meta.url), 'utf8'));
  const classSource = realSource.slice(realSource.indexOf('class StandaloneEditorInstance'), realSource.indexOf('// ── Extension registration'));
  const js = new Bun.Transpiler({ loader: 'ts', target: 'browser' }).transformSync(classSource);
  const api = { read: async () => ({}), branch: async () => ({}), save: async () => ({}), upload: async () => ({}) };
  const valid = (v: unknown) => typeof v === 'string' ? v.length > 0 : typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  const Real = new Function('getWorkspaceFile','getWorkspaceBranch','updateWorkspaceFile','uploadWorkspaceFile','validRevision','reviewOverwrite','isLargeDocumentContent',
    js + '\nreturn StandaloneEditorInstance;')(api.read,api.branch,api.save,api.upload,valid,async()=>null,()=>false);
  const real = Object.create(Real.prototype);
  Object.assign(real, { view: {}, contentText: 'old', initialContent: 'old', loadedRevision: 'old-revision', loading: false, disposed: false, dirty: false,
    captureViewState: () => ({}), renderEditorSurface: (text: string) => { real.contentText = text; real.initialContent = text; }, setDirty: (dirty: boolean) => { real.dirty = dirty; },
    updateSaveButton: () => {}, updateStatus: () => {} });
  const Lazy = loader(patchEditorLoaderRevision(source));
  const proxy = Object.create(Lazy.prototype); proxy.real = real;
  proxy.setContent('remote', 'mtime', 0);
  expect(real.loadedRevision).toBe(0); expect(real.contentText).toBe('remote');
  real.contentText='typed';real.dirty=true;
  proxy.setContent('next','mtime',undefined);
  expect(real.loadedRevision).toBeNull();
});
