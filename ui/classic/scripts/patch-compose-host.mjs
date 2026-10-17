// Host transport/safety seams missing from the current Piclaw composer. Vendored bytes stay unchanged.
// Rendering, drafts, picker layout, progress and queue return remain Piclaw's.
const once = (source, from, to) => {
  const index = source.indexOf(from);
  if (index < 0 || source.indexOf(from, index + from.length) >= 0) throw Error(`Compose host anchor changed: ${from.slice(0, 100)}`);
  return source.replace(from, to);
};
export function patchComposeHost(source) {
  let s = "import { startComposeResizeGesture } from '../gi-compose-resize.js';\n" + source;
  s = once(s, "useConnectionStatusPresentation(stateAccessFailed ? connectionStatus : 'connected')", 'useConnectionStatusPresentation(connectionStatus)');
  s = once(s, '    const dynamicCommandsRef = useRef(null);', "    const dynamicCommandsRef = useRef([]);\n    const [commandCatalogueFailed, setCommandCatalogueFailed] = useState(false);");
  const commandsStart = s.indexOf('        const chatJid = currentChatJid ||');
  const commandsEnd = s.indexOf('        return () => { cancelled = true; };', commandsStart);
  if (commandsStart < 0 || commandsEnd < 0) throw Error('Command catalogue lifecycle anchor changed');
  s = s.slice(0, commandsStart) + `        dynamicCommandsRef.current = [];
        setCommandCatalogueFailed(false);
        Promise.resolve().then(() => fetchCommands(currentChatJid || 'web:default')).then(data => {
            if (cancelled) return;
            if (!data || !Array.isArray(data.commands) || data.commands.some(cmd => !cmd || typeof cmd.name !== 'string' || !cmd.name.startsWith('/') || typeof cmd.description !== 'string')) throw Error('Invalid command catalogue');
            dynamicCommandsRef.current = data.commands;
            setCommandCatalogueFailed(false);
            if (textareaRef.current) updateSlashAutocomplete(textareaRef.current.value);
        }).catch(() => {
            if (cancelled) return;
            dynamicCommandsRef.current = [];
            setCommandCatalogueFailed(true);
        });
` + s.slice(commandsEnd);
  s = once(s, 'dynamicCommandsRef.current || SLASH_COMMANDS', 'dynamicCommandsRef.current');
  s = once(s, '                    ${showSlash && slashMatches.length > 0 && html`', '                    ${commandCatalogueFailed && content.startsWith(\'/\') && html`<div role="status">Command suggestions unavailable.</div>`}\n                    ${showSlash && slashMatches.length > 0 && html`');
  s = once(s, '        : { getItem: getLocalStorageItem, setItem: setLocalStorageItem };', '        : { getItem: getLocalStorageItem, setItem: setLocalStorageItem, removeItem: key => { try { localStorage.removeItem(key); } catch {} } };');
  s = once(s, '    return Math.min(Math.floor(window.innerHeight * 0.40), COMPOSE_AUTO_MAX_HEIGHT_CAP);', '    return window.innerWidth <= 639 ? Math.min(Math.floor(window.innerHeight * 0.30), 200) : Math.min(Math.floor(window.innerHeight * 0.40), COMPOSE_AUTO_MAX_HEIGHT_CAP);');
  s = once(s, '            recognition.stop();\n        } catch {', '            if (speechUiState.kind !== "requesting_permission") recognition.stop();\n        } catch {');
  s = once(s, '    }, [clearSpeechUiState]);\n\n    const handleSpeechToggle', '    }, [clearSpeechUiState, speechUiState.kind]);\n\n    const handleSpeechToggle');
  const cleanupStart = s.indexOf('    useEffect(() => {\n        if (!searchMode) return undefined;\n        void dictationRef.current?.cancel();');
  const cleanupEnd = s.indexOf('    useEffect(() => {\n        if (!statusNoticeIsCompaction)', cleanupStart);
  if (cleanupStart < 0 || cleanupEnd < 0) throw Error('Speech lifecycle anchors changed');
  s = s.slice(0,cleanupStart) + `    const retireNativeSpeech = () => {
        const recognition=speechRecognitionRef.current;
        speechRecognitionRef.current=null;
        speechPushToTalkActiveRef.current=false;
        if(recognition){recognition.abort?.();clearSpeechUiState();}
    };
    useEffect(() => { if(searchMode) {dictationRef.current?.cancel();retireNativeSpeech();} },[searchMode]);
    useEffect(() => { retireNativeSpeech(); },[currentChatJid]);
    useEffect(() => {
        const retire=()=>retireNativeSpeech();
        window.addEventListener('pagehide',retire);
        window.addEventListener('piclaw:open-settings',retire);
        const observer=new MutationObserver(()=>{if(document.querySelector('[aria-modal="true"]'))retire();});
        observer.observe(document.body,{childList:true,subtree:true});
        return()=>{observer.disconnect();window.removeEventListener('pagehide',retire);window.removeEventListener('piclaw:open-settings',retire);retire();};
    },[]);

` + s.slice(cleanupEnd);
  // Recognition ownership ends on manual edits; late callbacks cannot rewrite them.
  s = once(s, '        if (speechRecognitionRef.current && e?.isTrusted) {\n            stopSpeechRecognition();\n        }', '        if (speechRecognitionRef.current && e?.isTrusted) {\n            const recognition=speechRecognitionRef.current;\n            speechRecognitionRef.current=null;\n            recognition.abort?.();\n            clearSpeechUiState();\n        }');
  s = once(s, "                setSpeechUiState({\n                    kind: 'listening',\n                    title: 'Listening…',\n                    detail: 'Speak now. Tap the mic again to stop.',\n                });\n            };", "                setSpeechUiState({\n                    kind: 'listening',\n                    title: 'Listening…',\n                    detail: 'Speak now. Tap the mic again to stop.',\n                });\n                if (speechPendingStopRef.current) recognition.stop();\n            };");
  s = once(s, 'class=${`compose-inline-status compose-speech-status compose-speech-status-${speechUiState.kind}`} role="status"', 'class=${`compose-inline-status compose-speech-status compose-speech-status-${speechUiState.kind}`} role=${speechUiState.kind === "error" ? "alert" : "status"}');
  s = once(s, '                            aria-label=${speechButtonTitle}', '                            aria-pressed=${speechButtonActive ? "true" : "false"}\n                            aria-label=${speechButtonTitle}');
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
  s = once(s, 'resolvePopupTypeaheadMatch(currentSessionPopupEntries, nextBuffer.value, sessionPopupIndex, (item) => item.label)',
    'resolvePopupTypeaheadMatch(currentSessionPopupEntries, nextBuffer.value, -1, (item) => item.label)');
  s = once(s, '    const handleReturnQueuedFollowup = useCallback((queuedItem) => {\n        returnQueuedFollowupToEditor({',
    `    const handleReturnQueuedFollowup = useCallback((queuedItem) => {
        if (composeServices.returnQueuedFollowup) {
            const applyReturnedDraft = (draft) => {
                if (!draft || currentChatJidRef.current !== currentChatJid) return;
                setMediaFiles(draft.media); onSetFileRefs?.(draft.fileRefs); onSetMessageRefs?.(draft.messageRefs);
                onSetFolderRefs?.([]); setContent(draft.text);
                requestAnimationFrame(() => { const input = textareaRef.current; if (!input) return; input.value = draft.text; resizeTextarea(); input.selectionStart = input.selectionEnd = draft.text.length; input.focus(); });
            };
            void composeServices.returnQueuedFollowup(currentChatJid, queuedItem, applyReturnedDraft).catch(error => setSubmitError('Queue action failed: ' + (error?.message || 'Queue return incomplete')));
            return;
        }
        return returnQueuedFollowupToEditor({`);
  s = once(s, '    }, [onRemoveQueuedFollowup, onSetFileRefs, onSetFolderRefs, onSetMessageRefs, resizeTextarea]);',
    '    }, [onRemoveQueuedFollowup, onSetFileRefs, onSetFolderRefs, onSetMessageRefs, resizeTextarea, composeServices.returnQueuedFollowup, currentChatJid]);');
  // Capture, target and bubble handlers share this callback: consume each key once.
  s = once(s, '    const handlePopupKeyboardEvent = useCallback((e) => {',
    '    const handlePopupKeyboardEvent = useCallback((e) => {\n        if (e.defaultPrevented || e.target?.closest?.(".compose-session-popup-close")) return false;');
  s = once(s, '                                ref=${modelHintRef}\n', '                                ref=${modelHintRef}\n                                aria-haspopup="listbox"\n                                aria-expanded=${showModelPopup ? "true" : "false"}\n                                aria-controls=${showModelPopup ? "compose-model-results-host" : undefined}\n');
  s = once(s, '                            entries=${modelOptions}\n', '                            entries=${modelOptions}\n                            instanceKey="host"\n                            supportsThinking=${supportsThinking}\n');
  s = once(s, '        const ok = await runModelCommand(`/model ${modelLabel}`, modelLabel);',
    '        const pickerOwnedFocus = () => Boolean(modelPopupRef.current?.contains(document.activeElement));\n        const ok = await runModelCommand(`/model ${modelLabel}`, modelLabel);\n        const restorePickerFocus = pickerOwnedFocus();');
  s = once(s, '            requestAnimationFrame(() => modelHintRef.current?.focus?.());\n        }\n    };\n\n    const runSessionPopupEntry',
    '            if (restorePickerFocus) requestAnimationFrame(() => modelHintRef.current?.focus?.());\n        }\n    };\n\n    const runSessionPopupEntry');
  s = once(s, "requestOpenSettingsDialog({ section: 'models' });", "window.dispatchEvent(new CustomEvent('piclaw:open-settings', {detail: {section: 'models', opener: modelHintRef.current}}));");
  s = once(s, "            alert('Failed to switch model: ' + error.message);", "            setSubmitError('Failed to switch model: ' + error.message);");
  // Do not let keyboard activation leak through IME/repeated/consumed Enter into a prompt.
  s = once(s, '    const handleKeyDown = (e) => {',
    "    const handleKeyDown = (e) => {\n        if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || (e.repeat && (e.key === 'Enter' || e.key === 'Tab'))) return;");
  s = once(s, '    const title = activeCompactionLabel\n', '    const nativeTitle = activeCompactionLabel\n');
  s = once(s, '        : `${label}\\n${compactLabel}`;', '        : `${label}\\n${compactLabel}`;\n    const title = usage.hostTitle || nativeTitle;');
  s = once(s, '            aria-label=${title}\n            disabled=${!canCompact}', '            aria-label=${usage.hostLabel ? (usage.hostActive ? usage.hostLabel : `${usage.hostLabel}\\nCompact context`) : nativeTitle}\n            data-tooltip=${title}\n            aria-description=${usage.hostDescription || undefined}\n            disabled=${!canCompact}');
  s = once(s, '            class=${`compose-context-pie icon-btn${activeCompactionLabel ? \' is-compacting\' : \'\'}`}', '            class=${`compose-context-pie icon-btn${activeCompactionLabel || usage.hostActive ? \' is-compacting\' : \'\'}`}');
  s = once(s, '    const abortButtonState = resolveComposeAbortButtonState(isAgentActive, statusNoticeIsCompaction);', '    const abortButtonState = resolveComposeAbortButtonState(isAgentActive, statusNoticeIsCompaction);\n    if (abortButtonState && contextUsage?.hostStopPending) abortButtonState.disabled = true;');
  // A queued effect from an older render must not overwrite a synchronous edit.
  s = once(s, '        onContentChange?.(content);\n    }, [content]);', '        if (!textareaRef.current || textareaRef.current.value === content) onContentChange?.(content);\n    }, [content]);');
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
${clearBlock.replace('            setContent(\'\');', '            if (textareaRef.current) textareaRef.current.value = "";\n            onContentChange?.(\'\');\n            setContent(\'\');')}                const intercepted`);
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
