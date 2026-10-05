// Editor tab host: mounts the pane the registry resolves for a workspace path in edit mode (the vendored Piclaw 3.2.5
// editor for text files), as Piclaw's app-pane-runtime-orchestration does, and keeps a clean editor in step with
// `workspace_update` events. Refresh rules follow Piclaw 3.2.5 (`isWorkspaceUpdateRelevantForPath`,
// `shouldApplyWorkspaceEditorRefresh`, `refreshActiveEditorFromWorkspace`).
import { getWorkspaceFile } from './api.js';
import { paneRegistry } from './panes/pane-registry.js';
import { tabStore } from './panes/tab-store.js';
import type { PaneInstance } from './panes/pane-types.js';

// Container changes include drawer/layout changes, not just window resizes.
// Older browsers get a window fallback. Both paths are detached on disposal.
export function observeWorkspaceTab(container: HTMLElement, resized: () => void): () => void {
    const view = container.ownerDocument?.defaultView;
    if (!view) return () => {};
    if (view.ResizeObserver) {
        const observer = new view.ResizeObserver(resized);
        observer.observe(container);
        return () => observer.disconnect();
    }
    view.addEventListener('resize', resized);
    return () => view.removeEventListener('resize', resized);
}

type EditorInstance = PaneInstance & { getCurrentMtime?: () => string | null; onViewStateChange?: (cb: (state: unknown) => void) => void };

/** Paths a `workspace_update` entry reports as changed: `changed_paths`, else its subtree `path`, else the root. */
function changedPaths(update: any): string[] {
    const paths = Array.isArray(update?.changed_paths)
        ? update.changed_paths.map((value: unknown) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
        : [];
    if (paths.length) return paths;
    const path = typeof update?.path === 'string' ? update.path.trim() : '';
    return path ? [path] : ['.'];
}

export function isWorkspaceUpdateRelevantForPath(path: string, updates: unknown): boolean {
    if (!path) return false;
    if (!Array.isArray(updates) || updates.length === 0) return true;
    return updates.some(update => changedPaths(update).some(changed => changed === '.' || changed === path));
}

/** Mount the edit-mode pane for `path` into `container`; returns the disposer. */
export function mountEditorTab(container: HTMLElement, path: string, options: { close: () => void },
    read: (path: string, maxBytes: number, mode: string) => Promise<any> = getWorkspaceFile) {
    let live = true;
    let instance: EditorInstance | null = null;
    let unobserve: (() => void) | null = null;
    const context = { path, mode: 'edit' as const };
    const ext = paneRegistry.resolve(context) || paneRegistry.get('editor');
    if (!ext) throw new Error(`No editor for ${path}`);
    instance = ext.mount(container, context) as EditorInstance;
    instance.onDirtyChange?.((dirty: boolean) => { if (live) tabStore.setDirty(path, dirty); });
    instance.onClose?.(() => { if (live) options.close(); });
    instance.onViewStateChange?.((state: unknown) => { if (live) tabStore.saveViewState(path, state); });
    unobserve = observeWorkspaceTab(container, () => { if (live) instance?.resize?.(); });

    const refresh = async (event: Event) => {
        const mounted = instance;
        if (!live || !mounted?.setContent || mounted.isDirty?.()) return;
        if (!isWorkspaceUpdateRelevantForPath(path, (event as CustomEvent).detail?.updates)) return;
        try {
            const payload: any = await read(path, 1_000_000, 'edit');
            const text = typeof payload?.text === 'string' ? payload.text : '';
            const mtime = typeof payload?.mtime === 'string' && payload.mtime.trim() ? payload.mtime.trim() : new Date().toISOString();
            // Re-check after the fetch: the user may have typed or closed the tab meanwhile.
            if (!live || instance !== mounted || mounted.isDirty?.()) return;
            const current = mounted.getCurrentMtime?.() ?? null;
            if (current && current === mtime) return;
            mounted.setContent(text, mtime);
        } catch (error) {
            console.warn('[workspace_update] Failed to refresh active pane:', error);
        }
    };
    window.addEventListener('workspace-update', refresh);
    requestAnimationFrame(() => { if (live) instance?.focus?.(); });

    return () => {
        if (!live) return;
        live = false;
        window.removeEventListener('workspace-update', refresh);
        try { unobserve?.(); } catch { /* keep disposing */ }
        try { instance?.dispose(); } catch { /* never leave the host occupied */ }
        instance = null;
        container.replaceChildren();
    };
}

/** Piclaw's close confirmation for tabs with unsaved changes (use-editor-state.ts). */
export function confirmCloseTabs(ids: string[]): boolean {
    const dirty = ids.map(id => tabStore.get(id)).filter((tab: any) => tab?.dirty);
    if (!dirty.length) return true;
    if (ids.length === 1) return window.confirm(`"${(dirty[0] as any).label}" has unsaved changes. Close anyway?`);
    return window.confirm(`${dirty.length} unsaved tab${dirty.length > 1 ? 's' : ''} will be closed. Continue?`);
}
