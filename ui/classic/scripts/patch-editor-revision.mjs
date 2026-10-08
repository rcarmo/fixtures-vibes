// Revision-safe persistence over unmodified Piclaw v3.3.0 editor bytes.
const once = (source, from, to) => {
  const at = source.indexOf(from);
  if (at < 0 || source.indexOf(from, at + from.length) >= 0) throw Error(`Editor revision anchor changed: ${from.slice(0, 90)}`);
  return source.replace(from, to);
};
const method = (source, start, end, replacement) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < a || source.indexOf(start, a + start.length) >= 0) throw Error(`Editor revision method changed: ${start}`);
  return source.slice(0, a) + replacement + source.slice(b);
};
export function patchEditorRevision(source) {
  let s = source;
  s = once(s, "import { getWorkspaceBranch, getWorkspaceFile, updateWorkspaceFile, uploadWorkspaceFile } from '../../../web/src/api.js';",
    "import { getWorkspaceBranch, getWorkspaceFile, updateWorkspaceFile, createWorkspaceFile, uploadWorkspaceFile } from '../../../web/src/api.js';\nimport { validRevision, snapshotRevision, reviewOverwrite } from '../../../web/src/gi-revision-state.js';");
  s = once(s, '    private initialContent = \x27\x27;', '    private initialContent = \x27\x27;\n    private loadedRevision: string | number | null = null;');
  s = once(s, '    initialContent?: string;\n', '    initialContent?: string;\n    revision?: string | number | null;\n');
  s = once(s, "        initialContent: typeof raw.initialContent === 'string' ? raw.initialContent : undefined,",
    "        initialContent: typeof raw.initialContent === 'string' ? raw.initialContent : undefined,\n        revision: validRevision(raw.revision) ? raw.revision : null,");
  s = once(s, "        if (typeof state.initialContent === 'string') {\n            this.initialContent = state.initialContent;\n        }",
    "        if (typeof state.initialContent === 'string') {\n            this.initialContent = state.initialContent;\n            this.initialContentLength = state.initialContent.length;\n        }\n        this.loadedRevision = typeof state.initialContent === 'string' && validRevision(state.revision) ? state.revision : null;\n        this.updateSaveButton();");
  s = once(s, '            initialContent: this.initialContent,', '            initialContent: this.initialContent,\n            revision: this.loadedRevision,');
  s = once(s, "            this.mountEditor(data?.text || '', data?.mtime || null);",
    "            this.loadedRevision = snapshotRevision(data);\n            this.mountEditor(data?.text ?? '', data?.mtime || null);\n            this.updateSaveButton();\n            if (this.loadedRevision === null) this.updateStatusText('Revision-safe persistence unavailable — read-only saves');");
  s = method(s, '    private async handleSave(): Promise<void> {', '    // ── CodeMirror lifecycle', `    private async handleSave(expectedRevision: string | number | null = this.loadedRevision, overwrite = false): Promise<void> {
        if (this.disposed || this.saving || !this.view || (!this.dirty && !overwrite)) return;
        if (!validRevision(expectedRevision)) {
            this.updateStatusText('Revision-safe persistence unavailable — read-only saves');
            return;
        }
        const value = this.view.state.doc.toString();
        const path = this.path;
        if (!overwrite && value === this.initialContent) { this.checkDirty(true); return; }
        this.saving = true;
        this.updateSaveButton();
        this.updateStatusText('Saving…');
        this.saveRequestCb?.(value);
        try {
            const result = await updateWorkspaceFile(path, value, expectedRevision);
            if (this.disposed || this.path !== path) return;
            if (!validRevision(result?.revision)) {
                this.loadedRevision = null;
                throw new Error('Save acknowledgement omitted its revision; reload and review before saving again');
            }
            this.loadedRevision = result.revision;
            this.initialContent = value;
            this.initialContentLength = value.length;
            this.largeDocumentMode = isLargeDocumentContent(value);
            this.currentMtime = result?.mtime || this.currentMtime;
            this.conflictMonitor?.onSaved(this.currentMtime);
            // Only the captured text is acknowledged. Preserve newer text/cursor/scroll in either editor mode.
            if (this.isDiffMode()) {
                const current = this.view.state.doc.toString();
                this.renderEditorSurface(current, 'saved', this.captureViewState());
            }
            this.checkDirty(true);
            this.updateStatusText(this.dirty ? 'Saved previous edits; newer changes are unsaved' : 'All changes saved');
        } catch (err: any) {
            if (this.disposed || this.path !== path) return;
            if (err?.status === 409) this.conflictMonitor?.showConflict();
            this.updateStatusText(err?.status === 409 ? 'File conflict: saved revision changed; draft preserved' : \`Save failed: \${err.message || 'Unknown error'}\`);
        } finally {
            this.saving = false;
            if (!this.disposed) this.updateSaveButton();
        }
    }

`);
  s = once(s, '        this._saveBtn.disabled = !this.dirty || this.saving;', '        this._saveBtn.disabled = !this.dirty || this.saving || !validRevision(this.loadedRevision);\n        this._saveBtn.title = validRevision(this.loadedRevision) ? \'Save (Ctrl+S)\' : \'Revision-safe persistence unavailable — read-only saves\';');
  s = method(s, '    private initConflictMonitor(): void {', '    private updateStatusText(text: string): void {', `    private initConflictMonitor(): void {
        this.conflictMonitor?.dispose();
        if (!this.path) return;
        this.conflictMonitor = createFileConflictMonitor({
            path: this.path, getCurrentMtime: () => this.currentMtime,
            anchorParent: this.paneEl, anchorBefore: this.bodyEl, ownerDocument: this.ownerDocument,
            onReload: async () => {
                if (this.dirty && !this.ownerWindow.confirm('Reload and discard unsaved changes?')) return;
                const path = this.path;
                const content = this.view?.state.doc.toString();
                try {
                    const data = await getWorkspaceFile(path, EDITOR_MAX_BYTES, 'edit');
                    if (this.disposed || this.path !== path) return;
                    if (this.view?.state.doc.toString() !== content) {
                        this.updateStatusText('Newer edits are unsaved; reload cancelled');
                        this.conflictMonitor?.showConflict();
                        return;
                    }
                    const viewState = this.captureViewState();
                    this.loadedRevision = snapshotRevision(data);
                    this.setContent(data?.text ?? '', data?.mtime, this.loadedRevision);
                    this.restoreViewState(viewState);
                } catch (err: any) { this.updateStatusText(\`Reload failed: \${err.message}\`); }
            },
            onSaveCopy: async (copyPath) => {
                if (!this.view || !validRevision(this.loadedRevision)) return;
                const value = this.view.state.doc.toString();
                const split = copyPath.lastIndexOf('/');
                try {
                    await createWorkspaceFile(split < 0 ? '.' : copyPath.slice(0, split), copyPath.slice(split + 1), value);
                    this.updateStatusText(\`Saved copy to \${copyPath}\`);
                } catch (err: any) { this.updateStatusText(\`Save copy failed: \${err.message}\`); this.conflictMonitor?.showConflict(); }
            },
            onOverwrite: async () => {
                if (this.saving || !validRevision(this.loadedRevision)) return;
                const path = this.path;
                try {
                    const reviewed = await getWorkspaceFile(path, EDITOR_MAX_BYTES, 'edit');
                    const revision = snapshotRevision(reviewed);
                    if (!validRevision(revision)) throw new Error('Revision-safe persistence unavailable');
                    if (!await reviewOverwrite(this.ownerDocument, path, reviewed) || this.disposed || this.path !== path) return;
                    await this.handleSave(revision, true);
                } catch (err: any) { this.updateStatusText(\`Overwrite failed: \${err.message}\`); }
            },
        });
        this.conflictMonitor.start();
    }

`);
  s = once(s, '    setContent(content: string, mtime: string): void {', '    setContent(content: string, mtime: string, revision?: unknown): void {\n        this.loadedRevision = validRevision(revision) ? revision : null;');
  s = once(s, '        this.renderEditorSurface(content, this.diffMode, viewState);\n        this.setDirty(false);', '        this.renderEditorSurface(content, this.diffMode, viewState);\n        this.setDirty(false);\n        this.updateSaveButton();\n        if (this.loadedRevision === null) this.updateStatusText(\'Revision-safe persistence unavailable — read-only saves\');');
  s = once(s, '        this.path = newPath;\n', '        this.path = newPath;\n        this.loadedRevision = null;\n        this.updateSaveButton();\n');
  return s;
}

export function patchConflictRevision(source) {
  if (source.includes('showConflict()')) throw Error('Editor revision anchor changed: conflict adaptation already applied');
  let s = once(source, '    onSaved(newMtime: string | null) {', '    showConflict() { detected = true; stopPolling(); showBar(); },\n    onSaved(newMtime: string | null) {\n      if (barEl) { barEl.remove(); barEl = null; }');
  return once(s, '  stop(): void;', '  stop(): void;\n  showConflict(): void;');
}
export function patchEditorRefreshRevision(source) {
  return once(source, '      instance.setContent(nextText, nextMtime);', "      instance.setContent(nextText, nextMtime, typeof payload?.text === 'string' && payload?.truncated === false ? payload?.revision : null);");
}

/** Forward the revision snapshot through Piclaw's actual lazy editor proxy. */
export function patchEditorLoaderRevision(source) {
  return once(source,
    '    setContent(content: string, mtime: string): void {\n        if (this.real?.setContent) {\n            this.real.setContent(content, mtime);\n        }\n    }',
    '    setContent(content: string, mtime: string, revision?: unknown): void {\n        if (this.real?.setContent) {\n            this.real.setContent(content, mtime, revision);\n        }\n    }');
}
