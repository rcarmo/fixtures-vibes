import { test, expect } from 'bun:test';
import { themePreviews, previewColorKeys } from '../../src/gi-theme-preview';
import { WEB_THEME_PRESETS } from '../../piclaw/web-3.3.4/src/core/ui-theme-catalogue';
import { timelineAgents, postSessionName, sessionHandle, activeSessionTitle } from '../../src/gi-post-identity';
import { patchPostIdentity, patchTimelineIdentity } from '../../scripts/patch-post-identity.mjs';
import { readFileSync } from 'node:fs';

test('every catalogue preset previews its own palette; auto includes light and dark', () => {
    for (const preset of WEB_THEME_PRESETS) {
        const previews = themePreviews(preset);
        expect(previews.map(p => p.mode)).toEqual(preset.mode === 'auto' ? ['light', 'dark'] : [preset.mode]);
        for (const preview of previews) {
            expect(preview.colors.map(c => c.key)).toEqual([...previewColorKeys]);
            for (const entry of preview.colors) expect(entry.color).toBe(preset[preview.mode][entry.key]);
        }
    }
    expect(themePreviews(null)).toEqual([]);
});

test('refresh and rename preserve configured identity and per-chat bubbles for shared agent IDs', () => {
    const entries = [{ agent_id: 'agent', chat_jid: 'gi:a', agent_name: '@first' }, { agent_id: 'agent', chat_jid: 'gi:b', agent_name: 'second' }];
    const runtime = { assistant_name: 'Configured Assistant', assistant_avatar: '/avatar/agent' };
    const agents = timelineAgents(entries, runtime);
    expect(agents.agent.name).toBe(runtime.assistant_name);
    expect(agents.agent.avatar_url).toBe(runtime.assistant_avatar);
    expect(postSessionName({ chat_jid: 'gi:a' }, agents)).toBe('first');
    expect(postSessionName({ chat_jid: 'gi:b' }, agents)).toBe('second');
    expect(postSessionName({ chat_jid: 'gi:a', chat_agent_name: '@search-source' }, agents)).toBe('search-source');
    const renamed = timelineAgents([{ ...entries[0], agent_name: 'renamed' }], runtime);
    expect(renamed.agent.name).toBe(runtime.assistant_name);
    expect(postSessionName({ chat_jid: 'gi:a' }, renamed)).toBe('renamed');
    expect(postSessionName({ chat_jid: 'gi:a', data: { agent_id: '__gi_system__' } }, agents)).toBe('');
    expect(postSessionName({ chat_jid: 'gi:unknown' }, agents)).toBe('');
    expect(timelineAgents([], runtime).agent.name).toBe(runtime.assistant_name);
    expect(timelineAgents([], {}).agent.name).toBe('Gi');
    expect(sessionHandle(null)).toBe('');
    expect(sessionHandle(' @@name ')).toBe('name');
});

test('tab title tracks selected session and rename, never the last agent-ID match', () => {
    const entries = [{ chat_jid: 'gi:a', agent_name: '@first' }, { chat_jid: 'gi:b', agent_name: 'second' }];
    expect(activeSessionTitle(null, entries)).toBe('Gi');
    expect(activeSessionTitle('gi:a', entries)).toBe('@first — Gi');
    expect(activeSessionTitle('gi:b', entries)).toBe('@second — Gi');
    expect(activeSessionTitle('gi:a', entries)).toBe('@first — Gi');
    expect(activeSessionTitle('gi:a', [{ ...entries[0], agent_name: 'renamed' }])).toBe('@renamed — Gi');
    expect(activeSessionTitle('gi:new', entries)).toBe('@new — Gi');
    const app = readFileSync(new URL('../../src/app.ts', import.meta.url), 'utf8');
    expect(app).toContain('document.title = activeSessionTitle(');
    expect(app).toContain('}, [sessionId, activeChatAgents]);');
});

test('identity patches fail closed when vendored anchors move', () => {
    for (const [file, patch] of [['post', patchPostIdentity], ['timeline', patchTimelineIdentity]] as const) {
        const source = readFileSync(new URL(`../../piclaw/web-3.3.4/web/src/components/${file}.ts`, import.meta.url), 'utf8');
        expect(patch(source)).toContain('sessionName');
        expect(() => patch('changed')).toThrow('anchor changed');
    }
});
