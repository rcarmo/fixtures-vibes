# Piclaw 3.2.5 editor (vendored)

Unmodified Piclaw v3.2.5 sources (rcarmo/piclaw `de82f7a0b31b460311a2192570b5ef66b2c936af`, MIT), kept in their original
layout so their relative imports resolve inside this tree:

- `extensions/viewers/editor/`: the standalone CodeMirror editor pane (`StandaloneEditorInstance`), Markdown live
  preview, conflict monitor wiring, paste-image and search-reveal; `vendor/codemirror-entry.ts` is the CodeMirror vendor
  entry the editor needs.
- `web/src/`: the editor's direct web dependencies (`panes/editor-loader.ts`, `panes/file-conflict-monitor.ts`,
  `panes/pane-types.ts`, `ui/editor-file-reference.ts`, `ui/workspace-markdown-image.ts`, `utils/code-highlighting.ts`)
  and the tab orchestration hook `ui/use-editor-state.ts` with its `ui/addon-workspace-actions.ts`.

`SHA256SUMS` pins every file. `scripts/piclaw-editor-adapter.mjs` verifies the hashes, resolves imports of modules not
vendored here (`api.js`, `pane-registry.js`, `tab-store.js`, …) to `src/`, maps `#editor-vendor/codemirror` to the
external `/editor-vendor/codemirror.js`, and applies its anchored patches at build time; the build fails if a hash or
an anchor changes.
