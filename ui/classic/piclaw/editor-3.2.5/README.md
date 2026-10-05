# Piclaw 3.2.5 editor (vendored)

Unmodified Piclaw v3.2.5 sources (rcarmo/piclaw `de82f7a0b31b460311a2192570b5ef66b2c936af`, MIT), kept in their original
layout so their relative imports resolve inside this tree:

- `extensions/viewers/editor/`: the standalone CodeMirror editor pane (`StandaloneEditorInstance`), Markdown live
  preview, conflict monitor wiring, paste-image and search-reveal; `vendor/codemirror-entry.ts` is the CodeMirror vendor
  entry the editor needs.
- `web/src/`: the editor's direct web dependencies (`panes/editor-loader.ts`, `panes/file-conflict-monitor.ts`,
  `panes/pane-types.ts`, `ui/editor-file-reference.ts`, `ui/workspace-markdown-image.ts`, `utils/code-highlighting.ts`)
  and the tab orchestration hook `ui/use-editor-state.ts` with its `ui/addon-workspace-actions.ts`.
- The pane runtime the editor tabs run in: `ui/app-pane-runtime-orchestration.ts` (mounting, retained panes, Compare to
  Saved, zen mode, popout/reattach, workspace refresh) with `panes/retained-pane-cache.ts`; `components/tab-strip.ts`,
  `components/markdown-preview.ts` and `ui/app-pane-mode-render.ts` (pane windows); the popout helpers
  `ui/app-window-actions.ts`, `ui/app-branch-pane-orchestration.ts`, `ui/chat-window.ts`, `ui/use-splitters.ts`; the
  pane-open and zen shortcuts in `ui/app-browser-events.ts` (with `components/settings-dialog-events.ts`); and the
  tab viewers `panes/web-viewer-pane.ts`, `panes/data-viewer-pane.ts`, `panes/highlight-previewer-pane.ts`.

`src/gi-editor-pane.ts` composes these as Piclaw's app-main composition does; Classic has no dock, branch or add-on
surfaces. `src/ui/addon-web-extensions.ts` stands in for Piclaw's add-on registry, which Classic does not host.

`SHA256SUMS` pins every file. `scripts/piclaw-editor-adapter.mjs` verifies the hashes, resolves imports of modules not
vendored here (`api.js`, `pane-registry.js`, `tab-store.js`, …) to `src/`, maps `#editor-vendor/codemirror` to the
external `/editor-vendor/codemirror.js`, and applies its anchored patches at build time (the editor bundle path, and
`app-window-actions.ts`'s unused root-session API import); the build fails if a hash or an anchor changes.
