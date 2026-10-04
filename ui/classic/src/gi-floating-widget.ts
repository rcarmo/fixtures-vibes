// @ts-nocheck
// Host wiring for Piclaw's floating widget pane. Reuses Piclaw 3.2.5's host handlers
// (ui/app-floating-widget-followup.ts) so piclawWidget.submit/close/requestRefresh behave as on the reference:
// submit sends to the session that opened the widget (queued when a turn is active), close is local only,
// refresh rebuilds the dashboard snapshot from the session's status/context/queue/models/timeline.
import { useCallback, useEffect, useRef, useState } from './vendor/preact-htm.js';
import {
    buildFloatingWidgetDashboardData,
    closeFloatingWidgetFromHost,
    handleFloatingWidgetEventFromHost,
    openFloatingWidgetFromHost,
} from './ui/app-floating-widget-followup.js';
import {
    getActiveChatAgents, getAgentContext, getAgentModels, getAgentQueueState, getAgentStatus,
    getChatBranches, getTimeline, sendAgentMessage,
} from './api.js';

export function useGiFloatingWidget(options: {
    currentChatJid: string;
    isAgentTurnActive: boolean;
    snapshot: () => Record<string, unknown>;
    onMessageResponse?: (response: unknown) => void;
}) {
    const { currentChatJid, isAgentTurnActive, snapshot, onMessageResponse } = options;
    const [floatingWidget, setFloatingWidget] = useState<any>(null);
    const dismissedLiveWidgetKeysRef = useRef(new Set<string>());

    // Piclaw closes the pane on chat change, so a submit always targets the widget's own session.
    useEffect(() => { setFloatingWidget(null); }, [currentChatJid]);

    const openWidget = useCallback((widget: any) => {
        openFloatingWidgetFromHost({ widget, dismissedLiveWidgetKeysRef, setFloatingWidget });
    }, []);

    const closeWidget = useCallback(() => {
        closeFloatingWidgetFromHost({ dismissedLiveWidgetKeysRef, setFloatingWidget });
    }, []);

    const onWidgetEvent = useCallback((event: any, widget: any) => {
        const chatJid = currentChatJid;
        handleFloatingWidgetEventFromHost({
            event, widget,
            currentChatJid: chatJid,
            isComposeBoxAgentActive: isAgentTurnActive,
            setFloatingWidget,
            handleCloseFloatingWidget: closeWidget,
            handleMessageResponse: (response: unknown) => onMessageResponse?.(response),
            showIntentToast: () => {},
            sendAgentMessage,
            buildFloatingWidgetDashboardSnapshot: (requestPayload: unknown) => buildFloatingWidgetDashboardData({
                requestPayload,
                currentChatJid: chatJid,
                currentRootChatJid: chatJid,
                getAgentStatus: (jid: string) => getAgentStatus('default', jid),
                getAgentContext: (jid: string) => getAgentContext('default', jid),
                getAgentQueueState: (jid: string) => getAgentQueueState(jid),
                getAgentModels: (jid: string) => getAgentModels(jid),
                getActiveChatAgents,
                getChatBranches: (jid: string) => getChatBranches(jid),
                getTimeline: (limit: number, cursor: any, jid: string) => getTimeline(limit, cursor, jid),
                isAgentTurnActive,
                ...snapshot(),
            }),
        });
    }, [currentChatJid, isAgentTurnActive, snapshot, onMessageResponse, closeWidget]);

    return { floatingWidget, openWidget, closeWidget, onWidgetEvent };
}
