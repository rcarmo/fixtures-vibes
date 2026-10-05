// @ts-nocheck
/**
 * panes/index.ts — Pane system barrel export.
 *
 * Re-exports types, registry, and built-in pane extensions.
 * The editor extension is lazy-loaded (CodeMirror stays out of core bundle).
 */

export type { PanePlacement, PaneCapability, PaneContext, PaneHostAttachContext, PaneHostDetachContext, PaneInstance, WebPaneExtension } from './pane-types.js';
export { paneRegistry } from './pane-registry.js';
export { editorPaneExtension, preloadEditorBundle } from './editor-loader.js';
export { terminalPaneExtension, terminalTabPaneExtension, TERMINAL_TAB_PATH } from '../../piclaw/editor-3.2.5/web/src/panes/terminal-pane.ts';
export { vncPaneExtension, VNC_TAB_PREFIX, buildVncTabPath } from '../../piclaw/editor-3.2.5/web/src/panes/vnc-pane.ts';
export { workspacePreviewPaneExtension, workspaceMarkdownPreviewPaneExtension } from './workspace-preview-pane.js';
export { officeViewerPaneExtension } from './office-viewer-pane.js';
export { csvViewerPaneExtension } from './csv-viewer-pane.js';
export { pdfViewerPaneExtension } from './pdf-viewer-pane.js';
export { imageViewerPaneExtension } from './image-viewer-pane.js';
export { htmlViewerPaneExtension } from './html-viewer-pane.js';
export { videoViewerPaneExtension } from './video-viewer-pane.js';
export { drawioPaneExtension } from './drawio-pane.js';
export { mindmapPaneExtension } from './mindmap-pane.js';
export { kanbanPaneExtension } from './kanban-pane.js';
export type { TabState, TabViewState } from './tab-store.js';
export { tabStore } from './tab-store.js';
