// Gi host adapter for the vendored Piclaw Plan sidebar add-on (piclaw/plan-sidebar-0.1.25).
// The add-on talks to Piclaw's addon config API and default-agent message route; Gi serves the same
// semantics at /api/sessions/{s}/plan (docs/internal/session-plan.md) and the session prompt API.
import { sendAgentMessage } from './api.js';
import { requireRevision } from './gi-revision-state.js';
import { dispatchExtensionUiBrowserEvent, isExtensionUiEventType } from './ui/extension-ui-events.js';

const PLAN_PATH = '/agent/addons/api/plan-sidebar/plan';
const MESSAGE_PATH = '/agent/default/message';

function sessionOf(chatJid: string | null) {
    const sessionId = chatJid?.startsWith('gi:') ? chatJid.slice(3) : '';
    if (!sessionId) throw new Error('No active session');
    return sessionId;
}

async function json(url: string, init: RequestInit = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin', ...init,
        headers: { 'Content-Type': 'application/json', ...((init.headers as any) || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) throw Object.assign(new Error(payload?.error || `${response.status} ${response.statusText}`), { status: response.status, code: payload?.code });
    return payload;
}

/** Stands in for the add-on's apiJson(url, options). */
export async function giPlanSidebarRequest(url: string, options: RequestInit = {}) {
    const target = new URL(url, location.origin);
    const chatJid = target.searchParams.get('chat_jid');
    if (target.pathname === PLAN_PATH) {
        const planUrl = `/api/sessions/${encodeURIComponent(sessionOf(chatJid))}/plan`;
        if ((options.method || 'GET').toUpperCase() === 'GET') return (await json(planUrl)).plan;
        const body = JSON.parse(String(options.body || '{}'));
        const expected_revision = requireRevision(body.expected_revision);
        const payload = body.action === 'reset' ? { action: 'reset', expected_revision } : { markdown: String(body.markdown ?? ''), expected_revision };
        return json(planUrl, { method: 'POST', body: JSON.stringify(payload) });
    }
    if (target.pathname === MESSAGE_PATH) {
        const body = JSON.parse(String(options.body || '{}'));
        sessionOf(chatJid);
        await sendAgentMessage('default', String(body.content || ''), null, [], 'prompt', chatJid);
        return { ok: true };
    }
    throw new Error(`Unsupported Plan request: ${target.pathname}`);
}

let currentChatJid = '';
let installed = false;

/** Keep the add-on's view of the current chat in step with Gi's session. */
export function setPlanSidebarChat(chatJid: string) {
    if (chatJid === currentChatJid) return;
    currentChatJid = chatJid;
    const web = ((globalThis as any).__piclaw_web ||= {});
    web.getCurrentChatJid = () => currentChatJid;
    window.dispatchEvent(new CustomEvent('piclaw:current-chat-changed', { detail: { chatJid } }));
    if (!installed && chatJid) {
        installed = true;
        void import('../piclaw/plan-sidebar-0.1.25/index.ts');
    }
}

/** Forward extension UI SSE events (e.g. plan.changes) for the current chat to the add-on's window listeners. */
export function forwardPlanSidebarEvent(eventType: string, data: any) {
    if (!isExtensionUiEventType(eventType)) return;
    if (data?.chat_jid && data.chat_jid !== currentChatJid) return;
    dispatchExtensionUiBrowserEvent(eventType, data);
}
