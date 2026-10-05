// Piclaw 3.2.5 opens a detached pane in a window whose URL names it (chat-window.ts buildPanePopoutUrl).
export interface PanePopoutRequest { path: string; label: string }

/** The pane a `?pane_popout=1&pane_path=…` window shows (Piclaw's app-shell-state), or null for the main shell. Piclaw's
 * app-shell-state reads the mode on its own; a window without a path shows that no pane was named. */
export function readPanePopoutRequest(search: string): PanePopoutRequest | null {
    const params = new URLSearchParams(search);
    const mode = (params.get('pane_popout') || '').trim().toLowerCase();
    const path = (params.get('pane_path') || '').trim();
    if (!['1', 'true', 'yes'].includes(mode)) return null;
    return { path, label: (params.get('pane_label') || '').trim() };
}
