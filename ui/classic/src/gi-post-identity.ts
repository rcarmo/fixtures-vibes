import { SYSTEM_AGENT_ID } from './gi-conversation.js';
// Session labels belong to the picker/bubble, never to the assistant identity.
export function timelineAgents(entries: any[], runtime: any) {
    const identity = { name: runtime.assistant_name || 'Gi', avatar_url: runtime.assistant_avatar || null };
    const agents: Record<string, any> = { agent: { id: 'agent', ...identity } };
    for (const entry of entries) {
        agents[entry.agent_id] = { id: entry.agent_id, ...identity };
        agents[entry.chat_jid] = { session_name: sessionHandle(entry.agent_name) };
    }
    return agents;
}

export function sessionHandle(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/^@+/, '') : '';
}

export function activeSessionTitle(chatJid: string | null, entries: any[]): string {
    if (!chatJid) return 'Gi';
    const entry = entries.find(entry => entry.chat_jid === chatJid);
    const name = sessionHandle(entry?.agent_name) || sessionHandle(chatJid.replace(/^gi:/, ''));
    return `@${name} — Gi`;
}

export function postSessionName(post: any, agents: Record<string, any>): string {
    if (post.data?.agent_id === SYSTEM_AGENT_ID) return '';
    // Search carries the source session name. Otherwise use that post's chat,
    // not the selected chat or the last session sharing the same agent ID.
    return sessionHandle(post.chat_agent_name) || sessionHandle(agents[post.chat_jid]?.session_name);
}
