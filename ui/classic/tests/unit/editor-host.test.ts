import { test, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tabStore } from '../../src/panes/tab-store';
import { paneRegistry } from '../../src/panes/pane-registry';

const listeners = new Map<string, Set<(event: any) => void>>();
const confirms: string[] = [];
let confirmAnswer = true;
(globalThis as any).window = Object.assign((globalThis as any).window ?? {}, {
    addEventListener: (name: string, cb: any) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(cb); },
    removeEventListener: (name: string, cb: any) => listeners.get(name)?.delete(cb),
    confirm: (message: string) => { confirms.push(message); return confirmAnswer; },
});
(globalThis as any).requestAnimationFrame = (cb: () => void) => { cb(); return 0; };
const reads: any[] = [];
const host = await import('../../src/gi-editor-host');
const fire = (detail: any) => { for (const cb of [...(listeners.get('workspace-update') ?? [])]) cb({ detail }); };

function fakeEditor() {
    const state = { dirty: false, mtime: 'm1', content: 'v1', disposed: 0, set: [] as any[], dirtyCb: null as any, closeCb: null as any };
    const instance = {
        getContent: () => state.content, isDirty: () => state.dirty, getCurrentMtime: () => state.mtime,
        setContent: (text: string, mtime: string) => { state.set.push([text, mtime]); state.content = text; state.mtime = mtime; },
        focus() {}, resize() {}, dispose: () => { state.disposed++; },
        onDirtyChange: (cb: any) => { state.dirtyCb = cb; }, onClose: (cb: any) => { state.closeCb = cb; },
    };
    return { state, instance };
}

beforeEach(() => { tabStore.closeAll(); for (const tab of tabStore.getTabs()) tabStore.togglePin(tab.id); tabStore.closeAll(); confirms.length = 0; confirmAnswer = true; reads.length = 0; });

test('workspace_update relevance follows Piclaw: changed_paths, else subtree path, else root', () => {
    expect(host.isWorkspaceUpdateRelevantForPath('a.md', undefined)).toBe(true);
    expect(host.isWorkspaceUpdateRelevantForPath('a.md', [{ path: '.', changed_paths: ['b.md'] }])).toBe(false);
    expect(host.isWorkspaceUpdateRelevantForPath('a.md', [{ path: 'docs', changed_paths: ['a.md'] }])).toBe(true);
    expect(host.isWorkspaceUpdateRelevantForPath('a.md', [{ path: '.' }])).toBe(true);
    expect(host.isWorkspaceUpdateRelevantForPath('docs/a.md', [{ path: 'docs/a.md' }])).toBe(true);
    expect(host.isWorkspaceUpdateRelevantForPath('', [{ path: '.' }])).toBe(false);
});

test('edit-mode mount wires dirty state, close and disposal; a clean tab refreshes from workspace_update', async () => {
    const { state, instance } = fakeEditor();
    const contexts: any[] = [];
    paneRegistry.register({ id: 'test-editor', label: 'Test', capabilities: ['edit'], placement: 'tabs',
        canHandle: (c: any) => (c.mode === 'edit' && c.path?.endsWith('.fx') ? 100 : false), mount: (_: any, c: any) => { contexts.push(c); return instance as any; } });
    const payload: any = { text: 'v2', mtime: 'm2' };
    tabStore.open('a.fx');
    let closed = 0, cleared = 0;
    const container: any = { replaceChildren: () => cleared++, ownerDocument: { defaultView: null } };
    const stop = host.mountEditorTab(container, 'a.fx', { close: () => closed++ }, async (path: string, max: number, mode: string) => { reads.push([path, max, mode]); return payload; });
    expect(contexts).toEqual([{ path: 'a.fx', mode: 'edit' }]);
    state.dirty = true; state.dirtyCb(true);
    expect(tabStore.get('a.fx')?.dirty).toBe(true);
    fire({ updates: [{ path: '.', changed_paths: ['a.fx'] }] });
    await Promise.resolve();
    expect(reads).toEqual([]); // dirty: never overwritten
    state.dirty = false; state.dirtyCb(false);
    fire({ updates: [{ path: '.', changed_paths: ['other.md'] }] });
    fire({ updates: [{ path: '.', changed_paths: ['a.fx'] }] });
    await new Promise(r => setTimeout(r, 0));
    expect(reads).toEqual([['a.fx', 1_000_000, 'edit']]);
    expect(state.set).toEqual([['v2', 'm2']]);
    fire({ updates: [{ path: '.', changed_paths: ['a.fx'] }] }); // same mtime: no reload of the document
    await new Promise(r => setTimeout(r, 0));
    expect(state.set.length).toBe(1);
    state.closeCb();
    expect(closed).toBe(1);
    stop(); stop();
    expect(state.disposed).toBe(1);
    expect(cleared).toBe(1);
    expect(listeners.get('workspace-update')?.size ?? 0).toBe(0);
});

test('closing tabs with unsaved changes asks first, as Piclaw does', () => {
    tabStore.open('x.md'); tabStore.open('y.md'); tabStore.open('z.md');
    expect(host.confirmCloseTabs(['x.md'])).toBe(true);
    expect(confirms).toEqual([]);
    tabStore.setDirty('x.md', true); tabStore.setDirty('y.md', true);
    confirmAnswer = false;
    expect(host.confirmCloseTabs(['x.md'])).toBe(false);
    expect(host.confirmCloseTabs(['x.md', 'y.md', 'z.md'])).toBe(false);
    expect(confirms).toEqual(['"x.md" has unsaved changes. Close anyway?', '2 unsaved tabs will be closed. Continue?']);
});

test('container ResizeObserver and window fallback detach the exact listener', () => {
    const events: any[] = []; let observerCallback: any, listener: any;
    class RO { constructor(cb: any) { observerCallback = cb; } observe(target: any) { events.push(target); } disconnect() { events.push('disconnect'); } }
    const container: any = { ownerDocument: { defaultView: { ResizeObserver: RO } } };
    const stop = host.observeWorkspaceTab(container, () => events.push('resize')); observerCallback(); stop();
    expect(events).toEqual([container, 'resize', 'disconnect']);
    container.ownerDocument.defaultView = { addEventListener(name: any, cb: any) { events.push(name); listener = cb; }, removeEventListener(name: any, cb: any) { expect(name).toBe('resize'); expect(cb).toBe(listener); events.push('remove'); } };
    const fallback = host.observeWorkspaceTab(container, () => events.push('fallback')); listener(); fallback();
    expect(events.slice(-3)).toEqual(['resize', 'fallback', 'remove']);
});

test('vendored Piclaw 3.2.5 editor sources stay pinned', async () => {
    const { verifyPiclawEditor, patchEditorLoader } = await import('../../scripts/piclaw-editor-adapter.mjs');
    expect(() => verifyPiclawEditor(process.cwd())).not.toThrow();
    const loader = readFileSync('piclaw/editor-3.2.5/web/src/panes/editor-loader.ts', 'utf8');
    expect(patchEditorLoader(loader)).not.toContain('/static/classic/');
    expect(() => patchEditorLoader(loader.replaceAll('/static/classic/dist/editor.bundle.js', '/moved'))).toThrow('anchor changed');
    expect(createHash('sha256').update(loader).digest('hex')).toBe(readFileSync('piclaw/editor-3.2.5/SHA256SUMS', 'utf8').split('\n').find(l => l.endsWith('web/src/panes/editor-loader.ts'))!.split(/\s+/)[0]);
});
