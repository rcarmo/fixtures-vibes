// Host transport/safety seams missing from the current Piclaw composer. Vendored bytes stay unchanged.
// Rendering, drafts, picker layout, progress and queue return remain Piclaw's.
const once = (source, from, to) => {
  const index = source.indexOf(from);
  if (index < 0 || source.indexOf(from, index + from.length) >= 0) throw Error(`Compose host anchor changed: ${from.slice(0, 100)}`);
  return source.replace(from, to);
};
export function patchComposeHost(source) {
  let s = source;
  // A whole captured upload batch shares a cancellation lifetime, not one File at a time.
  s = once(s, '    const fetchCommands = composeServices.fetchCommands',
    '    const beginUploadBatch = composeServices.beginUploadBatch;\n    const fetchCommands = composeServices.fetchCommands');
  s = once(s, '        (async () => {\n            try {\n                const intercepted',
    '        const uploadBatch = capturedMediaFiles.length ? beginUploadBatch?.(submissionChatJid) : null;\n        (async () => {\n            try {\n                const intercepted');
  s = once(s, '(file, onProgress) => uploadOne(file, { onProgress }),',
    '(file, onProgress) => { uploadBatch?.signal.throwIfAborted(); return uploadOne(file, { onProgress, signal: uploadBatch?.signal }); },');
  s = once(s, "                const response = await sendMessage('default', message, null, mediaIds, resolveSubmitMode(submitMode), submissionChatJid);",
    "                uploadBatch?.signal.throwIfAborted();\n                uploadBatch?.end();\n                const response = await sendMessage('default', message, null, mediaIds, resolveSubmitMode(submitMode), submissionChatJid);");
  s = once(s, '            } finally {\n                if (trackSubmission) {',
    '            } finally {\n                uploadBatch?.end();\n                if (trackSubmission) {');
  // Seed pin presentation from authoritative metadata and never overwrite it with local preferences.
  s = once(s, '    useEffect(() => {\n        const applySessionPreferences = () => {',
    `    useEffect(() => {
        if (composeServices.pinSession) {
            setPinnedSessionChatJids(activeChatAgents.filter(chat => chat.pinned && !chat.archived_at).map(chat => chat.chat_jid));
            return;
        }
        const applySessionPreferences = () => {`);
  s = once(s, '    }, [sessionPreferenceRuntime]);', '    }, [sessionPreferenceRuntime, activeChatAgents, Boolean(composeServices.pinSession)]);');
  // Retain server-authoritative pins when the backend exposes them; otherwise use Piclaw's native local pins.
  s = once(s, '    const toggleSessionPin = useCallback((chatJid) => {\n        const preferences = togglePinnedSessionChatJid(chatJid, sessionPreferenceRuntime);',
    `    const toggleSessionPin = useCallback(async (chatJid) => {
        if (composeServices.pinSession) {
            const pinned = !pinnedSessionChatJids.includes(chatJid);
            try {
                await composeServices.pinSession(chatJid, pinned);
                setPinnedSessionChatJids(previous => pinned ? [...new Set([...previous, chatJid])] : previous.filter(id => id !== chatJid));
            } catch (error) { setSubmitError(error?.message || 'Failed to pin session'); }
            return;
        }
        const preferences = togglePinnedSessionChatJid(chatJid, sessionPreferenceRuntime);`);
  s = once(s, '    }, [currentChatJid]);\n\n    const handleRenameSession',
    '    }, [currentChatJid, sessionPreferenceRuntime, composeServices.pinSession, pinnedSessionChatJids]);\n\n    const handleRenameSession');
  // A passive-effect listener can survive a popup dismissal for one frame (notably WebKit). Once focus is back in
  // the editor, a stale capture listener must not consume its Enter as a session-row activation.
  s = once(s, '        const onKeyDown = (event) => {\n            handlePopupKeyboardEvent(event);',
    '        const onKeyDown = (event) => {\n            if (event.target === textareaRef.current) return;\n            handlePopupKeyboardEvent(event);');
  // Do not let keyboard activation leak through IME/repeated/consumed Enter into a prompt.
  s = once(s, '    const handleKeyDown = (e) => {',
    "    const handleKeyDown = (e) => {\n        if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || (e.repeat && (e.key === 'Enter' || e.key === 'Tab'))) return;");
  return s;
}
