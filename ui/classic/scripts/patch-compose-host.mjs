// Host transport/safety seams missing from the current Piclaw composer. Vendored bytes stay unchanged.
// Rendering, drafts, picker layout, progress and queue return remain Piclaw's.
const once = (source, from, to) => {
  const index = source.indexOf(from);
  if (index < 0 || source.indexOf(from, index + from.length) >= 0) throw Error(`Compose host anchor changed: ${from.slice(0, 100)}`);
  return source.replace(from, to);
};
export function patchComposeHost(source) {
  let s = "import { startComposeResizeGesture } from '../gi-compose-resize.js';\n" + source;
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
  s = once(s, '    const title = activeCompactionLabel\n', '    const nativeTitle = activeCompactionLabel\n');
  s = once(s, '        : `${label}\\n${compactLabel}`;', '        : `${label}\\n${compactLabel}`;\n    const title = usage.hostTitle || nativeTitle;');
  s = once(s, '            aria-label=${title}\n            disabled=${!canCompact}', '            aria-label=${usage.hostLabel ? `${usage.hostLabel}\\nCompact context` : nativeTitle}\n            data-tooltip=${title}\n            aria-description=${usage.hostDescription || undefined}\n            disabled=${!canCompact}');
  s = once(s, '            class=${`compose-context-pie icon-btn${activeCompactionLabel ? \' is-compacting\' : \'\'}`}', '            class=${`compose-context-pie icon-btn${activeCompactionLabel || usage.hostActive ? \' is-compacting\' : \'\'}`}');
  s = once(s, '    const abortButtonState = resolveComposeAbortButtonState(isAgentActive, statusNoticeIsCompaction);', '    const abortButtonState = resolveComposeAbortButtonState(isAgentActive, statusNoticeIsCompaction);\n    if (abortButtonState && contextUsage?.hostStopPending) abortButtonState.disabled = true;');
  // Journal trusted editor changes synchronously, before a page can close.
  s = once(s, '    const updateValue = (value) => {\n        if (searchMode)',
    '    const updateValue = (value) => {\n        if (!searchMode) onContentChange?.(value);\n        if (searchMode)');
  s = once(s, "            clearAfterSubmit = true,", "            clearAfterSubmit = !/^\\/compact\\s*$/i.test(overrideContent || \"\"),");
  s = once(s, "            ${activeCompactionLabel && html`<span class=\"compose-context-pie-timer\">${activeCompactionLabel}</span>`}", "            ${(activeCompactionLabel || usage.hostElapsed) && html`<span class=\"compose-context-pie-timer gi-compaction-elapsed\">${activeCompactionLabel || usage.hostElapsed}</span>`}");
  // Host durable capture must finish before the native editor clears or POST begins.
  s = once(s, '    const [mediaFiles, setMediaFiles] = useState([]);',
    '    const [mediaFiles, setMediaFiles] = useState(() => composeServices.initialMedia || []);\n    useEffect(() => { composeServices.onMediaChange?.(mediaFiles); }, [mediaFiles]);');
  const clearBlock = `        if (clearAfterSubmit) {
            setContent('');
            setMediaFiles([]);
            onClearFileRefs?.();
            onClearFolderRefs?.();
            onClearMessageRefs?.();
        }
`;
  s = once(s, clearBlock, '');
  s = once(s, '            try {\n                const intercepted',
    `            let hostCapture = null;
            try {
                hostCapture = clearAfterSubmit ? await composeServices.captureSubmission?.(submissionChatJid, { text: baseContent, media: capturedMediaFiles, fileRefs: [...capturedFileRefs, ...capturedFolderRefs], messageRefs: capturedMessageRefs }) : null;
${clearBlock}                const intercepted`);
  s = once(s, 'mediaIds, resolveSubmitMode(submitMode), submissionChatJid);',
    'mediaIds, resolveSubmitMode(submitMode), submissionChatJid, hostCapture ? { client_request_id: hostCapture.token } : {});');
  s = once(s, '                requireComposeAcknowledgement(response);',
    '                requireComposeAcknowledgement(response);\n                await composeServices.acceptSubmission?.(submissionChatJid, hostCapture?.token);');
  s = once(s, '                if (intercepted) {\n                    onPost?.(intercepted);',
    '                if (intercepted) {\n                    await composeServices.acceptSubmission?.(submissionChatJid, hostCapture?.token);\n                    onPost?.(intercepted);');
  s = once(s, '            } catch (error) {\n                if (clearAfterSubmit) {\n                    restoreDraft();\n                }',
    '            } catch (error) {\n                if (hostCapture) composeServices.failSubmission?.(submissionChatJid, hostCapture.token, error?.message || String(error));\n                if (clearAfterSubmit && (!composeServices.captureSubmission || hostCapture)) { restoreDraft(); }');
  const resizeStart = s.indexOf('    const startComposeResize = (startHeight, startY, handle) => {');
  const resizeEnd = s.indexOf('    const handleComposeResizeMouseDown =', resizeStart);
  if (resizeStart < 0 || resizeEnd < 0) throw Error('Compose resize lifecycle anchor changed');
  s = s.slice(0,resizeStart) + `    const startComposeResize = (startHeight, startY, handle) => {
        const textarea = textareaRef.current;
        if (!textarea || !handle || document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
        const previous = manualTextareaHeightRef.current;
        const chat = currentChatJid;
        startComposeResizeGesture({textarea,handle,startHeight,startY,
            apply: height => { const value=applyTextareaHeight(textarea,height);manualTextareaHeightRef.current=value;return value; },
            cancel: () => { manualTextareaHeightRef.current=previous; },
            commit: height => { if(persistBrowserState) composeStorage.setItem?.(composeHeightStorageKey,String(Math.round(height))); },
            current: () => textarea.isConnected && resizeChatRef.current===chat,
            jump: () => onJumpToLatest?.()});
    };
    const handleComposeResizeKey = event => {
        if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key) || document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
        event.preventDefault();event.stopPropagation();
        const textarea=textareaRef.current;if(!textarea)return;
        if(event.key==='Home'){manualTextareaHeightRef.current=null;composeStorage.removeItem?.(composeHeightStorageKey);resizeTextarea();return;}
        const height=event.key==='End'?getComposeManualHeightMax():textarea.getBoundingClientRect().height+(event.key==='ArrowUp'?10:-10);
        manualTextareaHeightRef.current=applyTextareaHeight(textarea,height);
        if(persistBrowserState)composeStorage.setItem?.(composeHeightStorageKey,String(Math.round(manualTextareaHeightRef.current)));
    };

` + s.slice(resizeEnd);
  s = once(s, '                onMouseDown=${handleComposeResizeMouseDown}', '                tabIndex="0"\n                onKeyDown=${handleComposeResizeKey}\n                onMouseDown=${handleComposeResizeMouseDown}');
  return s;
}
