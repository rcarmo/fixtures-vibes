import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Transpiler } from 'bun';
import { resolve } from 'node:path';
import { patchEditorRevision, patchConflictRevision, patchEditorRefreshRevision } from '../../scripts/patch-editor-revision.mjs';
import { validRevision, snapshotRevision, requireRevision, isRevisionConflict, reviewOverwrite } from '../../src/gi-revision-state';
import { piclawModule } from './piclaw-module';

const original = readFileSync(resolve(import.meta.dir, '../../piclaw/web-3.3.0/extensions/viewers/editor/editor-extension.ts'), 'utf8');
const patched = patchEditorRevision(original);
// Exercise methods of the actual adapted class without mounting CodeMirror; browser tests cover its DOM lifecycle.
const classText = patched.slice(patched.indexOf('class StandaloneEditorInstance'), patched.indexOf('// ── Extension registration'));
const js = new Transpiler({ loader: 'ts' }).transformSync(classText);
function editor(update: Function = async () => ({ revision: 'next', mtime: 'new-time' }), read: Function = async () => ({ text: 'remote', revision: 'remote-rev', truncated: false })) {
  let content = 'draft'; let conflict = 0; let copies: any[] = []; let options: any;
  const Klass = new Function('validRevision', 'snapshotRevision', 'isRevisionConflict', 'reviewOverwrite', 'updateWorkspaceFile', 'createWorkspaceFile', 'getWorkspaceFile', 'createFileConflictMonitor', 'isLargeDocumentContent', 'EDITOR_MAX_BYTES', `${js}; return StandaloneEditorInstance;`)(
    validRevision, snapshotRevision, isRevisionConflict, async () => true, update,
    async (...args) => { copies.push(args); }, read,
    (opts) => { options = opts; return monitor; }, () => false, 262144,
  );
  const monitor = { start() {}, stop() {}, dispose() {}, onSaved() {}, showConflict() { conflict++; } };
  const instance: any = Object.create(Klass.prototype);
  Object.assign(instance, { path: 'notes/a.md', loadedRevision: 'base-rev', initialContent: 'base', initialContentLength: 4, dirty: true,
    view: { state: { doc: { toString: () => content, get length() { return content.length; } } } },
    conflictMonitor: monitor, ownerWindow: { clearTimeout() {}, confirm: () => true },
    isDiffMode: () => false, updateSaveButton() {}, updateStatusText(message) { instance.status = message; },
    setDirty(value) { instance.dirty = value; }, captureViewState: () => ({}), restoreViewState() {},
  });
  return { instance, type: (value: string) => { content = value; }, conflict: () => conflict, copies: () => copies, options: () => options };
}

for (const value of ['opaque', 0, 23]) test(`preserves revision type ${JSON.stringify(value)}`, () => {
  expect(requireRevision(value)).toBe(value);
  expect(snapshotRevision({ text: '', revision: value, truncated: false })).toBe(value);
});
test('missing, coerced, unsafe and partial revisions fail closed', () => {
  for (const value of [undefined, null, '', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, {}, true]) {
    expect(validRevision(value)).toBe(false); expect(() => requireRevision(value)).toThrow(/read-only/);
  }
  for (const data of [{ text: '', revision: 'a' }, { text: '', revision: 'a', truncated: true }, { text: '', truncated: false }, {revision:'a',truncated:false}]) expect(snapshotRevision(data)).toBeNull();
});
test('overwrite confirmation reviews the complete snapshot in the owning window and requires explicit approval', async () => {
  const messages: string[] = [];
  let approved = false;
  const doc = { defaultView: { confirm: (message: string) => { messages.push(message); return approved; } } } as unknown as Document;
  const snapshot = { text: 'remote\ncomplete content', revision: 0, truncated: false };
  expect(await reviewOverwrite(doc, 'notes/a.md', snapshot)).toBe(false);
  approved = true;
  expect(await reviewOverwrite(doc, 'notes/a.md', snapshot)).toBe(true);
  expect(messages).toHaveLength(2);
  for (const message of messages) {
    expect(message).toContain('notes/a.md');
    expect(message).toContain(snapshot.text);
    expect(message).toContain('Another change will cause a new conflict.');
  }
  expect(snapshot.revision).toBe(0);
});
test('overwrite confirmation fails closed for incomplete snapshots and detached documents', async () => {
  let confirmations = 0;
  const doc = { defaultView: { confirm: () => { confirmations++; return true; } } } as unknown as Document;
  for (const snapshot of [{ text: 'partial', revision: 'r', truncated: true }, { text: 'missing revision', truncated: false }, { revision: 'r', truncated: false }]) {
    await expect(reviewOverwrite(doc, 'a.md', snapshot)).rejects.toThrow(/read-only/);
  }
  expect(confirmations).toBe(0);
  expect(await reviewOverwrite({ defaultView: null } as Document, 'a.md', { text: '', revision: 'r', truncated: false })).toBe(false);
});
test('acknowledges captured text without replacing typing during save (including same length)', async () => {
  let done: Function; const calls: any[] = [];
  const state = editor((...args) => { calls.push(args); return new Promise(resolve => { done = resolve; }); });
  const save = state.instance.handleSave();
  state.type('newer'); done!({ revision: 'next', mtime: 'new-time' }); await save;
  expect(calls).toEqual([['notes/a.md', 'draft', 'base-rev']]);
  expect(state.instance.initialContent).toBe('draft'); expect(state.instance.loadedRevision).toBe('next');
  expect(state.instance.getContent()).toBe('newer'); expect(state.instance.dirty).toBe(true);
  expect(state.instance.status).toContain('newer');
});
test('409 surfaces conflict immediately with unchanged mtime, retains baseline and draft, never retries', async () => {
  let calls = 0;
  const state = editor(async () => { calls++; throw Object.assign(new Error('stale'), { status: 409, code: 'revision_conflict', revision: 'do-not-adopt' }); });
  await state.instance.handleSave();
  expect(calls).toBe(1); expect(state.conflict()).toBe(1);
  expect(state.instance.loadedRevision).toBe('base-rev'); expect(state.instance.initialContent).toBe('base');
  expect(state.instance.getContent()).toBe('draft'); expect(state.instance.dirty).toBe(true);
});
test('missing load or acknowledgement revision disables later saves without dropping edits', async () => {
  let calls = 0; const state = editor(async () => { calls++; return { mtime: 'new-time' }; });
  await state.instance.handleSave(); await state.instance.handleSave();
  expect(calls).toBe(1); expect(state.instance.loadedRevision).toBeNull();
  expect(state.instance.getContent()).toBe('draft'); expect(state.instance.dirty).toBe(true);
});
test('duplicate saves and late disposed acknowledgements cannot update state', async () => {
  let done: Function; let calls = 0;
  const state = editor(() => { calls++; return new Promise(resolve => { done = resolve; }); });
  const save = state.instance.handleSave(); await state.instance.handleSave(); state.instance.disposed = true;
  done!({ revision: 'next' }); await save;
  expect(calls).toBe(1); expect(state.instance.loadedRevision).toBe('base-rev');
});
test('save-copy is create-only and does not clear the source draft', async () => {
  const state = editor(); state.instance.initConflictMonitor();
  await state.options().onSaveCopy('notes/a.copy.md');
  expect(state.copies()).toEqual([['notes', 'a.copy.md', 'draft']]);
  expect(state.instance.dirty).toBe(true); expect(state.instance.loadedRevision).toBe('base-rev');
});
test('typing while a confirmed reload is pending cancels replacement and keeps the conflict visible', async () => {
  let done: Function; const state = editor(undefined, () => new Promise(resolve => {done=resolve;}));
  state.instance.initConflictMonitor();const reload = state.options().onReload();state.type('typed during read');
  done!({text:'remote',revision:'remote-rev',truncated:false});await reload;
  expect(state.instance.getContent()).toBe('typed during read');expect(state.instance.loadedRevision).toBe('base-rev');
  expect(state.instance.initialContent).toBe('base');expect(state.instance.dirty).toBe(true);expect(state.conflict()).toBe(1);
});
test('declining discard does not read or alter the baseline', async () => {
  let reads=0;const state=editor(undefined,async()=>{reads++;return {};});state.instance.ownerWindow.confirm=()=>false;
  state.instance.initConflictMonitor();await state.options().onReload();
  expect(reads).toBe(0);expect(state.instance.getContent()).toBe('draft');expect(state.instance.loadedRevision).toBe('base-rev');
});
test('reviewed overwrite can replace changed remote content even when local text is clean', async () => {
  const calls: any[] = []; const state = editor(async (...args) => {calls.push(args);return {revision:'next'};});
  state.instance.initialContent = 'draft';state.instance.dirty = false;
  await state.instance.handleSave('reviewed-rev', true);
  expect(calls).toEqual([['notes/a.md','draft','reviewed-rev']]);expect(state.instance.loadedRevision).toBe('next');
});
test('revision adaptations fail closed on drift or duplicate application', () => {
  expect(() => patchEditorRevision(patched)).toThrow(/anchor changed/);
  const conflict = readFileSync(piclawModule('panes/file-conflict-monitor.ts'), 'utf8');
  expect(patchConflictRevision(conflict)).toContain('showConflict() { detected = true; stopPolling(); showBar(); }');
  expect(() => patchConflictRevision(patchConflictRevision(conflict))).toThrow(/anchor changed/);
  const refresh = readFileSync(piclawModule('ui/app-pane-runtime-orchestration.ts'), 'utf8');
  expect(patchEditorRefreshRevision(refresh)).toContain('payload?.truncated === false ? payload?.revision : null');
  expect(() => patchEditorRefreshRevision(patchEditorRefreshRevision(refresh))).toThrow(/anchor changed/);
});
