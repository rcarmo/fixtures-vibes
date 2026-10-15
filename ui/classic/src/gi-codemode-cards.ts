// Codemode web cards (#30). Two sources, one card:
//   - persisted tool_result rows (settled snapshot + measured duration_ms) for reload,
//   - runtime.tool topic envelopes for live nested rows.
// The legacy /sse/stream carries no nested envelopes (live-verified 2026-10-14), so the
// topic subscription is the only live source; it must not duplicate the settled snapshot.
// Text is kept literal: nothing here builds HTML from model output.

export type CodemodeCallStatus = 'ok' | 'error' | 'cancelled' | 'running' | null;

export type CodemodeCall = {
    id: string; name: string; args: string; status: CodemodeCallStatus;
    durationMs: number | null; error?: string; cost?: number;
    parent_tool_call_id: string | null;
};

export type CodemodeCard = {
    id: string; chat_jid: string; session_id: string; turn_id: string | null;
    tool_call_id: string; occurrence_id: string | null;
    script: string; status: CodemodeCallStatus;
    wall_seconds: number | null; output: string;
    duration_ms: number | null; calls: CodemodeCall[];
    full_output_path: string | null; live: boolean;
};

// Lifecycle comes from the envelope type, never from a payload phase guess.
const STATUS_BY_EVENT = { tool_started: 'running', tool_finished: 'ok', tool_failed: 'error', tool_cancelled: 'cancelled' } as const;

const HEADER = /^(Script completed|Script failed)\n(?:Wall time ([0-9.]+) seconds\n)?Output:\n?/;

/** Measured durations are recorded values; absent or invalid means unknown, zero is valid. */
export function measuredDuration(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return value;
}

/** Pi's wrapper header is separated from the literal output; the body is never re-parsed. */
export function parseCodemodeResult(content: unknown) {
    const text = typeof content === 'string' ? content : '';
    const match = HEADER.exec(text);
    if (!match) return { status: null, wall_seconds: null, output: text };
    return {
        status: match[1] === 'Script completed' ? 'ok' : 'error',
        wall_seconds: match[2] === undefined ? null : Number(match[2]),
        output: text.slice(match[0].length),
    };
}

/** Settled snapshot from the saved result; missing details degrade to no rows. */
export function settledCalls(payload: any): CodemodeCall[] {
    const raw = Array.isArray(payload?.details?.calls) ? payload.details.calls : [];
    return raw.map(c => ({
        id: String(c?.id ?? ''), name: String(c?.name ?? ''), args: typeof c?.args === 'string' ? c.args : '',
        status: ['ok', 'error', 'cancelled', 'running'].includes(c?.status) ? c.status : null,
        durationMs: measuredDuration(c?.durationMs),
        error: typeof c?.error === 'string' ? c.error : undefined,
        cost: typeof c?.cost === 'number' ? c.cost : undefined,
        parent_tool_call_id: null,
    })).filter(c => c.id);
}

/** Script source comes from the matching parent tool_call, not from the result text. */
export function codemodeScript(messages: any[], toolCallId: string, toolName = 'codemode'): string {
    for (const m of messages ?? []) {
        const calls = m?.payload?.tool_calls;
        if (!Array.isArray(calls)) continue;
        const hit = calls.find(c => String(c?.id) === toolCallId && String(c?.name) === toolName);
        if (hit) {
            const code = hit?.arguments?.code;
            return typeof code === 'string' ? code : '';
        }
    }
    return '';
}

export function projectCodemodeCard(message: any, opts: { fallbackSession?: string; script?: string } = {}): CodemodeCard | null {
    if (message?.role !== 'tool_result' || message?.payload?.kind !== 'tool_result') return null;
    if (message.payload?.tool_name !== 'codemode') return null;
    const parsed = parseCodemodeResult(message.content);
    // The saved result carries the output reference inside details, not at payload level.
    const path = typeof message.payload?.details?.fullOutputPath === 'string' ? message.payload.details.fullOutputPath : null;
    return {
        id: message.id, chat_jid: `gi:${message.session_id || opts.fallbackSession || ''}`,
        session_id: message.session_id || opts.fallbackSession || '',
        turn_id: message.payload?.turn_id || null,
        tool_call_id: String(message.payload?.tool_call_id || ''),
        occurrence_id: message.payload?.occurrence_id || null,
        script: opts.script ?? '',
        // A settled failure or unknown duration is never upgraded to ok or running.
        status: message.payload?.source === 'terminal_projection' && message.payload?.status === 'cancelled'
            ? 'cancelled' : (parsed.status ?? (message.payload?.is_error === true ? 'error' : null)),
        wall_seconds: parsed.wall_seconds, output: parsed.output,
        duration_ms: measuredDuration(message.payload?.duration_ms), calls: settledCalls(message.payload),
        full_output_path: path, live: false,
    };
}

export function statusFromEvent(envelope: any): CodemodeCallStatus {
    return (STATUS_BY_EVENT as Record<string, CodemodeCallStatus>)[String(envelope?.payload?.type ?? '')] ?? null;
}

/** The parent envelope is the only live source for a card before its result is saved. */
export function liveCardFromEnvelope(envelope: any, session: string): CodemodeCard | null {
    const p = envelope?.payload ?? {};
    const id = String(p.tool_call_id || '');
    if (!id || p.tool !== 'codemode' || p.parent_tool_call_id || !statusFromEvent(envelope)) return null;
    return {
        id: `${session}:${p.turn_id || ''}:${p.occurrence_id || id}`, chat_jid: `gi:${session}`, session_id: session, turn_id: p.turn_id || null,
        tool_call_id: id, occurrence_id: p.occurrence_id || null,
        script: typeof p.arguments?.code === 'string' ? p.arguments.code : '',
        status: statusFromEvent(envelope), wall_seconds: null, output: '',
        duration_ms: measuredDuration(p.duration_ms), calls: [], live: true,
    };
}

/** A topic envelope belongs to this card only when session, turn and parent match. */
export function staleCodemodeEvent(envelope: any, ctx: { session_id: string; tool_call_id: string; turn_id?: string | null }) {
    const p = envelope?.payload ?? {};
    if (!envelope || String(envelope.session_id || '') !== ctx.session_id) return true;
    if (String(p.parent_tool_call_id || '') !== ctx.tool_call_id) return true;
    if (ctx.turn_id && p.turn_id && String(p.turn_id) !== String(ctx.turn_id)) return true;
    return false;
}

/** A live card post is display-only until the saved result replaces it. */
export function liveCardPost(card: CodemodeCard) {
    return {
        id: `codemode:${card.id}`, display_row_id: `codemode:${card.id}`, chat_jid: card.chat_jid,
        timestamp: new Date().toISOString(), content: '', sender: 'agent', is_from_me: false, is_bot_message: true,
        data: { type: 'agent_response', content: '', thread_id: null, agent_id: null, content_meta: null, kind: 'tool_result', source: 'runtime', clipped: false, card },
    };
}

/** Apply one fenced topic envelope to the posts for `sessionId`; returns the same array when nothing changes. */
export function applyCodemodeEnvelope(posts: any[], envelope: any, sessionId: string, merge: (prev: any[], incoming: any[]) => any[]) {
    const p = envelope?.payload ?? {};
    const parent = String(p.parent_tool_call_id || '');
    const cardId = parent || String(p.tool_call_id || '');
    if (!cardId || String(envelope?.session_id || '') !== sessionId) return posts;
    const hit = posts.find(post => {
        const card = post?.data?.card;
        return card?.tool_call_id === cardId && card.session_id === sessionId
            && String(card.turn_id || '') === String(p.turn_id || '')
            && (parent || !p.occurrence_id || card.occurrence_id === p.occurrence_id);
    });
    if (hit) {
        const card = hit.data.card;
        if (!card.live) return posts;
        if (parent && staleCodemodeEvent(envelope, { session_id: sessionId, tool_call_id: parent, turn_id: card.turn_id })) return posts;
        const calls = parent ? mergeCodemodeLive(card.calls, envelope) : card.calls;
        const status = statusFromEvent(envelope);
        const duration = measuredDuration(p.duration_ms);
        if (calls === card.calls && status === null && duration === null) return posts;
        const next = { ...card, calls, status: parent ? card.status : (status ?? card.status), duration_ms: parent ? card.duration_ms : (duration ?? card.duration_ms), output: !parent && typeof p.output === 'string' ? parseCodemodeResult(p.output).output : card.output };
        return posts.map(post => post === hit ? { ...post, data: { ...post.data, card: next } } : post);
    }
    if (parent) return posts;
    const card = liveCardFromEnvelope(envelope, sessionId);
    if (!card) return posts;
    return merge(posts, [liveCardPost(card)]);
}

/** The saved result is the settled snapshot; it replaces the live card for the same parent call. */
export function replaceSettledCard(posts: any[], post: any) {
    const card = post?.data?.card;
    if (!card) return posts;
    const live = posts.find(p => {
        const existing = p?.data?.card;
        return existing?.live && existing.tool_call_id === card.tool_call_id
            && existing.session_id === card.session_id && existing.turn_id === card.turn_id
            && (card.occurrence_id ? existing.occurrence_id === card.occurrence_id : !existing.occurrence_id);
    });
    if (!live) return posts;
    return posts.map(p => p === live ? { ...p, id: post.id, display_row_id: post.display_row_id, data: { ...p.data, card } } : p);
}

/** Live rows are keyed by nested call id; the settled snapshot replaces them once the parent terminalises. */
export function mergeCodemodeLive(rows: CodemodeCall[], envelope: any): CodemodeCall[] {
    const p = envelope?.payload ?? {};
    if (!p?.tool_call_id) return rows;
    const status = (STATUS_BY_EVENT as Record<string, CodemodeCallStatus>)[String(envelope?.payload?.type ?? '')] ?? null;
    const row: CodemodeCall = {
        id: String(p.tool_call_id), name: String(p.tool ?? ''), args: p.arguments ? JSON.stringify(p.arguments) : '',
        status, durationMs: measuredDuration(p.duration_ms),
        error: typeof p.error === 'string' ? p.error : undefined,
        cost: typeof p.cost === 'number' ? p.cost : undefined,
        parent_tool_call_id: p.parent_tool_call_id ? String(p.parent_tool_call_id) : null,
    };
    const existing = rows.find(r => r.id === row.id);
    if (existing) {
        // A terminal occurrence is immutable: never overwrite a finished row with a later start.
        if (existing.status !== null && existing.status !== 'running' && status === 'running') return rows;
        return rows.map(r => r.id === row.id ? { ...r, ...row } : r);
    }
    return [...rows, row];
}

export function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/** Every interpolated value is a text node; model output is never treated as markup. */
export function renderCodemodeCard(post: any, html: any) {
    const card = post?.data?.card;
    if (!card || typeof card !== 'object') return null;
    const rows = Array.isArray(card.calls) ? card.calls : [];
    return html`
        <div class="codemode-card" data-card-id=${String(card.id || '')}>
            <div class="codemode-card-head">
                <span class="codemode-card-status">${String(card.status ?? 'unknown')}</span>
                ${card.duration_ms !== null ? html`<span class="codemode-card-duration">${formatDuration(card.duration_ms)}</span>` : null}
            </div>
            ${card.script ? html`<pre class="codemode-card-script">${card.script}</pre>` : null}
            ${rows.length ? html`<ul class="codemode-card-calls">${rows.map(row => html`
                <li>${`${row.name}${row.args ? ` ${row.args}` : ''}`}${row.status ? ` — ${row.status}` : ''}${row.durationMs !== null && row.durationMs !== undefined ? ` (${formatDuration(row.durationMs)})` : ''}</li>`)}</ul>` : null}
            ${card.output ? html`<pre class="codemode-card-output">${card.output}</pre>` : null}
        </div>`;
}
