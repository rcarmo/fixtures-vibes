// Shared Classic identity presentation, without changing pinned Piclaw bytes.
function replace(source, from, to) {
    if (source.split(from).length !== 2) throw Error('Post identity anchor changed: ' + from);
    return source.replace(from, to);
}
export function patchTimelineIdentity(source) {
    source = replace(source, "import { getAgentAvatarUrl, getAgentName } from '../ui/agent-utils.js';", "import { postSessionName } from '../gi-post-identity.js';\nimport { getAgentAvatarUrl, getAgentName } from '../ui/agent-utils.js';");
    return replace(source, '                        agentName=${getAgentName(post.data?.agent_id, agents || {})}', '                        sessionName=${postSessionName(post, agents || {})}\n                        agentName=${getAgentName(post.data?.agent_id, agents || {})}');
}
export function patchPostIdentity(source) {
    source = replace(source, 'onScrollToMessage, agentName, agentAvatarUrl,', 'onScrollToMessage, agentName, sessionName, agentAvatarUrl,');
    // Search already supplies a keyboard-accessible reference bubble: keep it
    // and its action, rather than adding a duplicate session tag.
    return replace(source, '                    <span class="post-author">${displayName}</span>', `                    <span class="post-author">\${displayName}</span>
                    \${isAgent && sessionName && !showSearchChatAgentTag && html\`<span class="post-chat-agent-tag post-session-tag">@\${sessionName}</span>\`}`);
}
