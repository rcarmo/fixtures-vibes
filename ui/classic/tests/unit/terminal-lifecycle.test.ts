import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { patchTerminalLifecycle } from '../../scripts/patch-terminal-lifecycle.mjs';

const source = readFileSync(new URL('../../piclaw/web-3.3.0/web/src/panes/terminal-pane.ts', import.meta.url), 'utf8');
function methods(text: string) {
  const load = text.slice(text.indexOf('  loadAddon(addon, name) {'), text.indexOf('  installPreOpenAddons(runtime) {'));
  const dispose = text.slice(text.indexOf('  dispose() {', text.indexOf('class TerminalPaneInstance')), text.indexOf('\n}\n\nexport const terminalPaneExtension'));
  return new Function(`const debugTerminalCleanup = () => {}; return {${load},${dispose}};`)();
}
function fixture(text: string) {
  const order: string[] = [], pending = new Set<any>(), callbacks: (() => void)[] = [];
  let dead = false;
  const pane = Object.assign(methods(text), {
    disposed: false, loadedAddons: [], addonDisposables: [],
    ownerWindow: {}, clearHeartbeat() {}, clearReconnectTimer() {},
    root: { remove() { order.push('root'); } },
    terminal: {
      loadAddon(addon: any) {
        pending.add(addon);
        const dispose = addon.dispose;
        addon.dispose = () => { if (!pending.delete(addon)) return; dispose(); };
      },
      dispose() { dead = true; order.push('core'); for (const addon of pending) addon.dispose(); },
    },
  });
  for (const name of ['fit', 'ligatures', 'renderer']) {
    const addon = { dispose() { order.push(name); if (dead) callbacks.push(() => { throw Error('missing renderer dimensions'); }); } };
    pane.loadAddon(addon, name);
    if (name === 'fit') pane.fitAddon = addon;
    if (name === 'renderer') pane.rendererAddon = addon;
  }
  return { pane, order, callbacks };
}

test('all loaded addons dispose before the core, once, in reverse order', () => {
  const original = fixture(source);
  original.pane.dispose();
  expect(original.callbacks.length).toBeGreaterThan(0);
  expect(() => original.callbacks[0]()).toThrow('missing renderer dimensions');
  const patched = fixture(patchTerminalLifecycle(source));
  patched.pane.dispose();
  patched.pane.dispose();
  expect(patched.order).toEqual(['renderer', 'ligatures', 'fit', 'core', 'root']);
  expect(patched.callbacks).toEqual([]);
  expect(patched.pane.addonDisposables).toEqual([]);
  expect(patched.pane.loadedAddons).toEqual(['fit', 'ligatures', 'renderer']);
});

test('failed addon loads are not retained; a failing disposer cannot stop core cleanup', () => {
  const f = fixture(patchTerminalLifecycle(source));
  const failed = { dispose() { throw Error('must not retain failed load'); } };
  const load = f.pane.terminal.loadAddon;
  f.pane.terminal.loadAddon = () => { throw Error('activation failed'); };
  expect(f.pane.loadAddon(failed, 'failed')).toBeNull();
  expect(f.pane.addonDisposables).not.toContain(failed);
  f.pane.terminal.loadAddon = load;
  f.pane.loadAddon({ dispose() { throw Error('dispose failed'); } }, 'broken');
  f.pane.dispose();
  expect(f.order.slice(-2)).toEqual(['core', 'root']);
});

test('lifecycle adaptation rejects missing, duplicated and already patched anchors', () => {
  expect(() => patchTerminalLifecycle('drift')).toThrow();
  expect(() => patchTerminalLifecycle(source + source)).toThrow();
  expect(() => patchTerminalLifecycle(patchTerminalLifecycle(source))).toThrow();
});
