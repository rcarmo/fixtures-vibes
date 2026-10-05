// Preact wrapper for the editor tab host (gi-editor-host.ts).
import { html, useLayoutEffect, useRef } from './vendor/preact-htm.js';
import { mountEditorTab } from './gi-editor-host.js';

export function EditorTab({ path, onClose }: { path: string; onClose: () => void }) {
    const host = useRef<HTMLElement>(null);
    const close = useRef(onClose);
    useLayoutEffect(() => { close.current = onClose; });
    useLayoutEffect(() => mountEditorTab(host.current!, path, { close: () => close.current?.() }), [path]);
    return html`<div class="editor-pane-instance" ref=${host}></div>`;
}

