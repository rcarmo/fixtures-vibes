// Gi's SSE lifecycle adaptations over Piclaw's use-sse-connection (supplied bytes unchanged):
// - pagehide closes the stream and marks a wake, so a page restored from the back/forward cache reconnects and
//   reloads instead of keeping a stale EventSource (Gi 041afc1: queued sends reconcile across reconnects);
// - `selectionKey` (default: the chat) reopens the stream when the selected session changes and drops events and
//   status changes from a stream that no longer matches the selection (Gi 9734628: session-local model selection).
import { patch } from './piclaw-web.mjs';

export const patchSseConnection = source => patch(source, 'use-sse-connection.ts', [
  [`  win.addEventListener('focus', handleWindowFocus);\n`,
    `  const handlePageHide = () => {\n    pendingWake = true;\n    sse.disconnect?.();\n  };\n\n  win.addEventListener('focus', handleWindowFocus);\n  win.addEventListener('pagehide', handlePageHide);\n`],
  [`    win.removeEventListener('focus', handleWindowFocus);\n`,
    `    win.removeEventListener('focus', handleWindowFocus);\n    win.removeEventListener('pagehide', handlePageHide);\n`],
  ['export function useSseConnection({ handleSseEvent, handleConnectionStatusChange, loadPosts, onWake, chatJid }) {\n',
    'export function useSseConnection({ handleSseEvent, handleConnectionStatusChange, loadPosts, onWake, chatJid, selectionKey = chatJid }) {\n  const selectionRef = useRef(selectionKey);\n  selectionRef.current = selectionKey;\n'],
  ['  useEffect(() => {\n    const sse = new SSEClient(\n      (type, data) => sseEventRef.current(type, data),\n      (status) => statusChangeRef.current(status),\n',
    '  useEffect(() => {\n    let active = true;\n    const sse = new SSEClient(\n      (type, data) => { if (active && selectionRef.current === selectionKey) sseEventRef.current(type, data); },\n      (status) => { if (active && selectionRef.current === selectionKey) statusChangeRef.current(status); },\n'],
  ['    return () => {\n      disposeWakeLifecycle();\n      sse.disconnect();\n    };\n  }, [chatJid]);\n',
    '    return () => {\n      active = false;\n      disposeWakeLifecycle();\n      sse.disconnect();\n    };\n  }, [chatJid, selectionKey]);\n'],
]);
