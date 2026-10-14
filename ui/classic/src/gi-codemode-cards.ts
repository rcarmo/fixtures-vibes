// Codemode web cards (#30). Two sources, one card:
//   - persisted tool_result rows (settled snapshot + measured duration_ms) for reload,
//   - runtime.tool topic envelopes for live nested rows.
// The legacy /sse/stream carries no nested envelopes (live-verified 2026-10-14), so the
// topic subscription is the only live source; it must not duplicate the settled snapshot.
// Text is kept literal: nothing here builds HTML from model output.

export type CodemodeCall = {
    id: string; name: string; args: string; status: 'ok' | 'error' | 'cancelled' | 'running';
    durationMs?: number; error?: string; cost?: number;
};

export type CodemodeCard = {
    id: string; chat_jid: string; session_id: string; turn_id: string | null;
    tool_call_id: string; occurrence_id: string | null;
    script: string; status: 'ok' | 'error' | 'running';
    wall_seconds: number | null; output: string;
    duration_ms: number | null; calls: CodemodeCardCall[];
    full_output_path: string | null; live: boolean;
};

export type CodemodeCardCall = CodemodeCall & { parent_tool_call_id: string | null };

const HEADER = /^(Script completed|Script failed)\n(?:Wall time ([0-9.]+) seconds\n)?Output:\n?/;

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
export function settledCalls(payload: any): CodemodeCardCall[] {
    const raw = Array.isArray(payload?.details?.calls) ? payload.details.calls : [];
    return raw.map(c => ({
        id: String(c?.id ?? ''), name: String(c?.name ?? ''), args: typeof c?.args === 'string' ? c.args : '',
        status: ['ok', 'error', 'cancelled'].includes(c?.status) ? c.status : 'ok',
        durationMs: typeof c?.durationMs === 'number' ? c.durationMs : undefined,
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
    const duration = Number.isInteger(message.payload?.duration_ms) && message.payload.duration_ms >= 0 ? message.payload.duration_ms : null;
    const path = typeof message.payload?.fullOutputPath === 'string' ? message.payload.fullOutputPath : null;
    return {
        id: message.id, chat_jid: `gi:${message.session_id || opts.fallbackSession || ''}`,
        session_id: message.session_id || opts.fallbackSession || '',
        turn_id: message.payload?.turn_id || null,
        tool_call_id: String(message.payload?.tool_call_id || ''),
        occurrence_id: message.payload?.occurrence_id || null,
        script: opts.script ?? '', status: parsed.status ?? (duration !== null ? 'ok' : 'running'),
        wall_seconds: parsed.wall_seconds, output: parsed.output,
        duration_ms: duration, calls: settledCalls(message.payload),
        full_output_path: path, live: false,
    };
}

/** A topic envelope belongs to this card only when session, turn and parent match. */
export function staleCodemodeEvent(envelope: any, ctx: { session_id: string; tool_call_id: string; turn_id?: string | null }) {
    const p = envelope?.payload ?? envelope;
    if (!p || String(p.session_id || '') !== ctx.session_id) return true;
    if (String(p.parent_tool_call_id || '') !== ctx.tool_call_id) return true;
    if (ctx.turn_id && p.turn_id && String(p.turn_id) !== String(ctx.turn_id)) return true;
    return false;
}

/** Live rows are keyed by nested call id; the settled snapshot replaces them once the parent terminalises. */
export function mergeCodemodeLive(rows: CodemodeCardCall[], envelope: any): CodemodeCardCall[] {
    const p = envelope?.payload ?? envelope;
    if (!p?.tool_call_id) return rows;
    const row: CodemodeCardCall = {
        id: String(p.tool_call_id), name: String(p.tool ?? p.name ?? ''), args: p.arguments ? JSON.stringify(p.arguments) : '',
        status: p.error ? 'error' : (p.phase === 'tool' ? 'running' : 'ok'),
        durationMs: Number.isInteger(p.duration_ms) && p.duration_ms >= 0 ? p.duration_ms : undefined,
        error: typeof p.error === 'string' ? p.error : undefined,
        cost: typeof p.cost === 'number' ? p.cost : undefined,
        parent_tool_call_id: p.parent_tool_call_id ? String(p.parent_tool_call_id) : null,
    };
    const existing = rows.find(r => r.id === row.id);
    if (existing) {
        // A terminal occurrence is immutable: never overwrite a finished row with a later start.
        if (existing.status !== 'running' && row.status === 'running') return rows;
        return rows.map(r => r.id === row.id ? { ...r, ...row } : r);
    }
    return [...rows, row];
}

export function formatDuration(ms?: number | null): string {
    if (ms === undefined || ms === null) return '';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
