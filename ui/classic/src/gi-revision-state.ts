// Opaque loaded revisions are document baselines, not freshness tokens to fetch at save time.
export type Revision = string | number;
export function validRevision(value: unknown): value is Revision {
    return (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}
export function snapshotRevision(snapshot: any): Revision | null {
    return snapshot && typeof snapshot.text === 'string' && snapshot.truncated === false && validRevision(snapshot.revision) ? snapshot.revision : null;
}
export function requireRevision(value: unknown): Revision {
    if (!validRevision(value)) throw Object.assign(new Error('Revision-safe persistence is unavailable; this document is read-only.'), { code: 'revision_required' });
    return value;
}
export function isRevisionConflict(error: any): boolean {
    return error?.status === 409 && ['revision_conflict', 'plan_revision_conflict', 'file_revision_conflict'].includes(error?.code);
}

/** Render the exact snapshot whose revision will authorise Overwrite; never adopt a revision from an error. */
export function reviewOverwrite(doc: Document, path: string, snapshot: any): Promise<boolean> {
    requireRevision(snapshotRevision(snapshot));
    return new Promise(resolve => {
        const previous = doc.activeElement as HTMLElement | null;
        const overlay = doc.createElement('div');
        overlay.className = 'revision-review-overlay';
        // Inline layout also works in popouts, which mount the editor outside the main app shell.
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0009;display:flex;align-items:center;justify-content:center;padding:12px';
        const panel = doc.createElement('div');
        panel.className = 'revision-review-panel';
        panel.style.cssText = 'box-sizing:border-box;width:800px;max-width:100%;max-height:90vh;overflow:auto;background:var(--bg-primary,#151922);color:var(--text-primary,#eee);border:1px solid var(--border-color,#555);border-radius:8px;padding:16px';
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Review overwrite');
        const title = doc.createElement('h3'); title.textContent = `Review saved content: ${path}`;
        const help = doc.createElement('p'); help.textContent = 'Overwrite replaces this reviewed version with your draft. Another change will cause a new conflict.';
        const text = doc.createElement('textarea'); text.readOnly = true; text.value = String(snapshot.text ?? snapshot.content ?? ''); text.setAttribute('aria-label', 'Current saved content');
        text.style.cssText = 'box-sizing:border-box;width:100%;height:45vh;resize:vertical;background:var(--bg-secondary,#222);color:inherit;font-family:monospace';
        const actions = doc.createElement('div'); actions.className = 'revision-review-actions';
        actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px';
        const accept = doc.createElement('button'); accept.type = 'button'; accept.textContent = 'Overwrite reviewed revision';
        const cancel = doc.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
        const finish = (approved: boolean) => { overlay.remove(); previous?.isConnected && previous.focus(); resolve(approved); };
        accept.onclick = () => finish(true); cancel.onclick = () => finish(false);
        panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
            if (event.key === 'Tab') {
                const nodes = [text, accept, cancel]; const at = nodes.indexOf(doc.activeElement as any);
                if ((event.shiftKey && at <= 0) || (!event.shiftKey && at === nodes.length - 1)) { event.preventDefault(); nodes[event.shiftKey ? nodes.length - 1 : 0].focus(); }
            }
        });
        actions.append(accept, cancel); panel.append(title, help, text, actions); overlay.append(panel); doc.body.append(overlay); text.focus();
    });
}
