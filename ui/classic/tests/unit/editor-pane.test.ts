import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readPanePopoutRequest } from '../../src/gi-pane-popout-request';
import { patchEditorLoader, patchWindowActions, verifyPiclawEditor } from '../../scripts/piclaw-editor-adapter.mjs';

const vendored = (file: string) => readFileSync(`piclaw/editor-3.2.5/web/src/${file}`, 'utf8');
const pinned = (file: string) => readFileSync('piclaw/editor-3.2.5/SHA256SUMS', 'utf8').split('\n').find(l => l.endsWith(`web/src/${file}`))!.split(/\s+/)[0];

test('vendored Piclaw 3.2.5 editor and pane runtime sources stay pinned', () => {
    expect(() => verifyPiclawEditor(process.cwd())).not.toThrow();
    for (const file of ['panes/editor-loader.ts', 'ui/use-editor-state.ts', 'ui/app-pane-runtime-orchestration.ts', 'components/tab-strip.ts']) {
        expect(createHash('sha256').update(vendored(file)).digest('hex')).toBe(pinned(file));
    }
});

test('anchored patches change only the editor bundle path and the unused root-session action', () => {
    const loader = vendored('panes/editor-loader.ts');
    expect(patchEditorLoader(loader)).toContain("'/dist/editor.bundle.js'");
    expect(patchEditorLoader(loader)).not.toContain('/static/classic/');
    expect(() => patchEditorLoader(loader.replaceAll('/static/classic/dist/editor.bundle.js', '/moved'))).toThrow('anchor changed');
    const actions = vendored('ui/app-window-actions.ts');
    const patched = patchWindowActions(actions);
    expect(patched).not.toContain("from '../api.js'");
    expect(patched.replace(/^const defaultCreateRootChatSession = .*\n/m, '')).toBe(actions.replace(/^import \{ createRootChatSession .*\n/m, ''));
    expect(() => patchWindowActions(actions.replace("from '../api.js'", "from './api.js'"))).toThrow('anchor changed');
});

test('a pane window is named by pane_popout/pane_path/pane_label, as Piclaw builds it', () => {
    expect(readPanePopoutRequest('?chat_jid=gi:1')).toBeNull();
    expect(readPanePopoutRequest('?pane_popout=0&pane_path=a.md')).toBeNull();
    expect(readPanePopoutRequest('?pane_popout=1&pane_path=notes%2Fa.md&pane_label=a.md&chat_jid=gi:1')).toEqual({ path: 'notes/a.md', label: 'a.md' });
    expect(readPanePopoutRequest('?pane_popout=TRUE&pane_path=+a.md+')).toEqual({ path: 'a.md', label: '' });
    expect(readPanePopoutRequest('?pane_popout=yes')).toEqual({ path: '', label: '' });
});
