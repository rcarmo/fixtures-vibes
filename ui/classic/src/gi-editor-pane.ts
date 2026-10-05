// The Piclaw 3.2.5 editor pane in the Classic shell. Tab orchestration (use-editor-state), the pane runtime
// (app-pane-runtime-orchestration: mounting, retained panes, Compare to Saved, zen mode, popout/reattach and the
// workspace_update refresh of a clean editor), the tab strip, Markdown preview and pane-popout rendering are the
// vendored Piclaw sources (piclaw/editor-3.2.5). This module composes them as Piclaw's app-main-* composition and
// app-main-shell-render do, without the branch, dock and add-on surfaces Classic does not host.
import { html, useCallback, useEffect } from './vendor/preact-htm.js';
import { getWorkspaceFile } from './api.js';
import { tabStore } from './panes/index.js';
import { TERMINAL_TAB_PATH } from './panes/terminal-pane.js';
import { VNC_TAB_PREFIX } from './panes/vnc-pane.js';
import { createEditorPopoutTransferPayload } from './panes/editor-popout-transfer.js';
import { createPaneHostTransferPayload } from './panes/pane-host-transfer.js';
import { registerPaneLiveTransfer } from './panes/pane-live-transfer.js';
import { useEditorState } from '../piclaw/editor-3.2.5/web/src/ui/use-editor-state.ts';
import { usePaneRuntimeOrchestration } from '../piclaw/editor-3.2.5/web/src/ui/app-pane-runtime-orchestration.ts';
import { renderPanePopoutMode } from '../piclaw/editor-3.2.5/web/src/ui/app-pane-mode-render.ts';
import { popOutPane } from '../piclaw/editor-3.2.5/web/src/ui/app-window-actions.ts';
import { resolvePanePopoutTransfer } from '../piclaw/editor-3.2.5/web/src/ui/app-branch-pane-orchestration.ts';
import { watchPaneOpenEvents, watchZenModeShortcuts } from '../piclaw/editor-3.2.5/web/src/ui/app-browser-events.ts';
import { isStandaloneWebAppMode } from '../piclaw/editor-3.2.5/web/src/ui/chat-window.ts';
import { TabStrip } from '../piclaw/editor-3.2.5/web/src/components/tab-strip.ts';
import { MarkdownPreview } from '../piclaw/editor-3.2.5/web/src/components/markdown-preview.ts';
import type { PanePopoutRequest } from './gi-pane-popout-request.js';

export function useGiEditorPane({ chatJid, popout = null }: { chatJid: string; popout?: PanePopoutRequest | null }) {
    const editor = useEditorState();
    const pane = usePaneRuntimeOrchestration({
        panePopoutMode: Boolean(popout),
        panePopoutPath: popout?.path || '',
        panePopoutLabel: popout?.label || '',
        chatOnlyMode: false,
        editorOpen: editor.editorOpen,
        tabStripTabs: editor.tabStripTabs,
        tabStripActiveId: editor.tabStripActiveId,
        previewTabs: editor.previewTabs,
        diffTabs: editor.diffTabs,
        tabPaneOverrides: editor.tabPaneOverrides,
        terminalTabPath: TERMINAL_TAB_PATH,
        vncTabPrefix: VNC_TAB_PREFIX,
        openEditor: editor.openEditor,
        closeEditor: editor.closeEditor,
        getWorkspaceFile,
    });
    const isWebAppMode = isStandaloneWebAppMode();

    // Piclaw's popOutPaneAction (app-branch-pane-lifecycle-actions): hand the pane's state to a standalone window.
    const handlePopOutPane = useCallback(async (path: string, label?: string | null) => {
        const detachTransfer = pane.buildPaneDetachTransfer?.(path) || null;
        return popOutPane({
            isWebAppMode, path, label, currentChatJid: chatJid, baseHref: window.location.href,
            resolveSourceTransfer: async (panePath: string) => {
                const sourceTransfer = await resolvePanePopoutTransfer({
                    panePath,
                    activateTab: (id: string) => tabStore.activate(id),
                    getActiveTabId: () => tabStore.getActiveId(),
                    tabStripActiveId: editor.tabStripActiveId,
                    editorInstanceRef: pane.editorInstanceRef,
                    dockInstanceRef: { current: null },
                    terminalTabPath: TERMINAL_TAB_PATH,
                    resolveTab: (id: string) => tabStore.get(id),
                    buildEditorPopoutTransfer: (sourcePath: string) => {
                        if (!sourcePath) return null;
                        const instance = pane.editorInstanceRef.current;
                        const dirty = typeof instance?.isDirty === 'function' ? instance.isDirty() : false;
                        return createEditorPopoutTransferPayload({
                            path: sourcePath,
                            content: dirty && typeof instance?.getContent === 'function' ? instance.getContent() : undefined,
                            paneOverrideId: editor.tabPaneOverrides instanceof Map ? (editor.tabPaneOverrides.get(sourcePath) || null) : null,
                            viewState: tabStore.getViewState(sourcePath) || null,
                        });
                    },
                });
                const source = pane.editorInstanceRef.current;
                const exported = typeof source?.exportHostTransferState === 'function' ? source.exportHostTransferState() : null;
                const hostTransfer = exported ? createPaneHostTransferPayload({ path: panePath, payload: exported }) : null;
                if (detachTransfer?.paneInstanceId && detachTransfer?.paneWindowId && source && exported?.kind !== 'terminal') {
                    registerPaneLiveTransfer({
                        panePath, paneInstanceId: detachTransfer.paneInstanceId, paneWindowId: detachTransfer.paneWindowId,
                        instance: source,
                        releaseSourceHost: () => { if (pane.editorInstanceRef.current === source) pane.editorInstanceRef.current = null; },
                    });
                }
                return { ...(sourceTransfer || {}), ...(hostTransfer || {}), ...(detachTransfer?.params || {}) };
            },
            onPaneWindowOpened: (panePath: string, handle: any, params: Record<string, string> | null) => {
                pane.registerDetachedPaneWindow(panePath, label, handle, params);
            },
        });
    }, [chatJid, editor.tabPaneOverrides, editor.tabStripActiveId, isWebAppMode, pane.buildPaneDetachTransfer, pane.registerDetachedPaneWindow]);

    // Piclaw's watchPaneOpenEventBridge.
    useEffect(() => watchPaneOpenEvents({
        openTab: (path, label) => editor.openEditor(path, label ? { label } : undefined),
        editSource: (path, label) => editor.openEditor(path, { ...(label ? { label } : {}), paneOverrideId: 'editor' }),
        popOutPane: (path, label) => { void handlePopOutPane(path, label); },
    }), [editor.openEditor, handlePopOutPane]);

    // Piclaw's app-shell-shortcuts (zen mode; Classic has no dock).
    useEffect(() => {
        if (popout) return undefined;
        return watchZenModeShortcuts({
            toggleZenMode: pane.toggleZenMode, exitZenMode: pane.exitZenMode,
            zenMode: pane.zenMode, isZenModeActive: () => pane.zenMode,
        });
    }, [popout, pane.exitZenMode, pane.toggleZenMode, pane.zenMode]);

    // The shell forwards workspace_update SSE events here (Piclaw's app-sse-events).
    useEffect(() => {
        const refresh = (event: Event) => { void pane.refreshActiveEditorFromWorkspace((event as CustomEvent).detail?.updates); };
        window.addEventListener('workspace-update', refresh);
        return () => window.removeEventListener('workspace-update', refresh);
    }, [pane.refreshActiveEditorFromWorkspace]);

    return { editor, pane, handlePopOutPane, isWebAppMode };
}

type EditorPane = ReturnType<typeof useGiEditorPane>;

/** The editor pane container and splitter of Piclaw's main shell (app-main-shell-render), without the dock. */
export function renderEditorPane({ editor, pane, handlePopOutPane, isWebAppMode }: EditorPane) {
    if (!editor.editorOpen) return null;
    const activeId = editor.tabStripActiveId;
    const detached = pane.activeDetachedTab;
    return html`
        <div class="editor-pane-container">
            ${pane.zenMode && html`<div class="zen-hover-zone"></div>`}
            <${TabStrip}
                tabs=${editor.tabStripTabs}
                activeId=${activeId}
                onActivate=${editor.handleTabActivate}
                onClose=${editor.handleTabClose}
                onCloseOthers=${editor.handleTabCloseOthers}
                onCloseAll=${editor.handleTabCloseAll}
                onTogglePin=${editor.handleTabTogglePin}
                onTogglePreview=${editor.handleTabTogglePreview}
                onToggleDiff=${editor.handleTabToggleDiff}
                onEditSource=${editor.handleTabEditSource}
                previewTabs=${editor.previewTabs}
                diffTabs=${editor.diffTabs}
                paneOverrides=${editor.tabPaneOverrides}
                detachedTabs=${pane.detachedTabs}
                onReattachTab=${pane.reattachPane}
                onToggleZen=${pane.toggleZenMode}
                zenMode=${pane.zenMode}
                onPopOutTab=${isWebAppMode ? undefined : handlePopOutPane}
            />
            ${detached && html`
                <div class="editor-pane-host editor-pane-detached-host">
                    <div class="editor-empty-state">
                        <div class="editor-empty-state-title">${detached.label || detached.panePath || 'Detached pane'}</div>
                        <div class="editor-empty-state-body">This pane is detached into another window.</div>
                        <div class="editor-empty-state-actions">
                            <button class="editor-empty-state-button" onClick=${() => pane.reattachPane(detached.panePath)}>Reattach here</button>
                        </div>
                    </div>
                </div>
            `}
            ${!detached && html`<div class="editor-pane-host" ref=${pane.editorContainerRef}></div>`}
            ${!detached && activeId && editor.previewTabs.has(activeId) && html`
                <${MarkdownPreview}
                    getContent=${() => pane.editorInstanceRef.current?.getContent?.()}
                    subscribeContentChange=${(cb: (content: string) => void) => pane.editorInstanceRef.current?.onContentChange?.(cb)}
                    path=${activeId}
                    onClose=${() => editor.handleTabTogglePreview(activeId)}
                />
            `}
        </div>
        <div class="editor-splitter"></div>
    `;
}

/** A standalone pane window (`?pane_popout=1`): Piclaw's renderPanePopoutMode. */
export function GiPanePopout({ popout, chatJid }: { popout: PanePopoutRequest; chatJid: string }) {
    const { editor, pane } = useGiEditorPane({ chatJid, popout });
    return renderPanePopoutMode({
        appShellRef: { current: null },
        editorOpen: editor.editorOpen,
        hidePanePopoutControls: pane.hidePanePopoutControls,
        panePopoutHasMenuActions: pane.panePopoutHasMenuActions,
        panePopoutTitle: pane.panePopoutTitle,
        tabStripTabs: editor.tabStripTabs,
        tabStripActiveId: editor.tabStripActiveId,
        handleTabActivate: editor.handleTabActivate,
        previewTabs: editor.previewTabs,
        diffTabs: editor.diffTabs,
        handleTabTogglePreview: editor.handleTabTogglePreview,
        handleTabToggleDiff: editor.handleTabToggleDiff,
        editorContainerRef: pane.editorContainerRef,
        getPaneContent: () => pane.editorInstanceRef.current?.getContent?.(),
        subscribePaneContentChange: (cb: (content: string) => void) => pane.editorInstanceRef.current?.onContentChange?.(cb),
        panePopoutPath: popout.path,
        canReattachPane: pane.canReattachPanePopout,
        handleReattachPane: pane.requestPanePopoutReattach,
    });
}
