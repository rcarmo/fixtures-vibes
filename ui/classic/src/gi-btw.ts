// @ts-nocheck
/**
 * Classic host for Piclaw 3.2.5's /btw side conversation and intent toasts.
 *
 * Mirrors the BTW part of Piclaw's useSidepanelOrchestration and the intent toast of its
 * compose-reference orchestration, calling the vendored helpers (ui/btw, ui/app-btw-orchestration)
 * and rendering the vendored BtwPanel. Classic's wider side-panel orchestration is not used.
 */
import { html, useCallback, useEffect, useRef, useState } from './vendor/preact-htm.js';
import { streamSidePrompt, sendAgentMessage } from './api.js';
import { BtwPanel } from '../piclaw/editor-3.2.5/web/src/components/btw-panel.ts';
import { buildBtwInjectionText, parseBtwCommand, resolveBtwChatJid } from '../piclaw/editor-3.2.5/web/src/ui/btw.ts';
import {
    closeBtwPanelSession,
    handleBtwInterceptCommand,
    injectBtwSession,
    runBtwPromptSession,
} from '../piclaw/editor-3.2.5/web/src/ui/app-btw-orchestration.ts';

/** Piclaw's intent toast: one transient title/detail shown in the status area (AgentStatus `intent`). */
export function useGiIntentToast() {
    const [intentToast, setIntentToast] = useState(null);
    const timerRef = useRef(null);
    const clearIntentToast = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setIntentToast(null);
    }, []);
    const showIntentToast = useCallback((title, detail = null, kind = 'info', durationMs = 3000) => {
        clearIntentToast();
        setIntentToast({ title, detail: detail || null, kind: kind || 'info' });
        timerRef.current = setTimeout(() => {
            setIntentToast((current) => (current?.title === title ? null : current));
        }, durationMs);
    }, [clearIntentToast]);
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
    return { intentToast, showIntentToast };
}

export function useGiBtw({ currentChatJid, isAgentActive, showIntentToast, onMessageResponse }) {
    const [btwSession, setBtwSession] = useState(null);
    const btwAbortRef = useRef(null);

    const closeBtwPanel = useCallback(() => {
        closeBtwPanelSession({ btwAbortRef, setBtwSession });
    }, []);

    const runBtwPrompt = useCallback(async (question) => runBtwPromptSession({
        question,
        currentChatJid,
        streamSidePrompt,
        resolveBtwChatJid,
        showIntentToast,
        btwAbortRef,
        setBtwSession,
    }), [currentChatJid, showIntentToast]);

    const handleBtwIntercept = useCallback(async ({ content }) => handleBtwInterceptCommand({
        content,
        parseBtwCommand,
        closeBtwPanel,
        runBtwPrompt,
        showIntentToast,
    }), [closeBtwPanel, runBtwPrompt, showIntentToast]);

    const handleBtwRetry = useCallback(() => {
        if (btwSession?.question) void runBtwPrompt(btwSession.question);
    }, [btwSession, runBtwPrompt]);

    const handleBtwInject = useCallback(async () => {
        await injectBtwSession({
            btwSession,
            buildBtwInjectionText,
            isComposeBoxAgentActive: isAgentActive,
            currentChatJid,
            sendAgentMessage,
            handleMessageResponse: onMessageResponse,
            showIntentToast,
        });
    }, [btwSession, currentChatJid, isAgentActive, onMessageResponse, showIntentToast]);

    const btwPanel = html`<${BtwPanel}
        session=${btwSession}
        onClose=${closeBtwPanel}
        onRetry=${handleBtwRetry}
        onInject=${handleBtwInject}
    />`;
    return { btwPanel, handleBtwIntercept };
}
