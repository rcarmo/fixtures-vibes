// Live codemode rows arrive only on the topic stream (live-verified 2026-10-14); the
// legacy /sse/stream carries no nested envelopes. This subscription is scoped to one
// session and must not duplicate the settled snapshot the parent terminal writes.
import { staleCodemodeEvent } from './gi-codemode-cards.js';

export const CODEMODE_TOPIC = 'runtime.tool';

export function topicUrl(sessionId: string, base = ''): string {
    return `${base}/sse/topics?topic=${encodeURIComponent(CODEMODE_TOPIC)}&session_id=${encodeURIComponent(sessionId)}`;
}

/**
 * Opens one topic source per session. `open` is injectable so the session fence and the
 * superseded-source guard are testable without a browser.
 */
export function openCodemodeTopic(sessionId: string, onEnvelope: (envelope: any) => void, opts: {
    open?: (url: string) => any;
    base?: string;
    isActive?: () => boolean;
} = {}) {
    const open = opts.open ?? ((url: string) => new EventSource(url));
    const isActive = opts.isActive ?? (() => true);
    const source = open(topicUrl(sessionId, opts.base ?? ''));
    if (!source) return null;

    source.addEventListener?.('message', (event: any) => {
        // A frame from a superseded source is dropped, as the stream client does.
        if (!isActive()) return;
        try {
            const envelope = JSON.parse(event.data);
            // Session identity is on the envelope; the card-level parent/turn fence is applied at merge.
            if (String(envelope?.session_id || '') !== sessionId) return;
            onEnvelope(envelope);
        } catch {}
    });
    return source;
}

export { staleCodemodeEvent };
