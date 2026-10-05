import { test, expect } from 'bun:test';
import { forwardPlanSidebarEvent, setPlanSidebarChat } from '../../src/gi-plan-sidebar';
import { piclawModule } from './piclaw-module';
const { handleOpenWorkspaceFileBrowserRequest } = await import(piclawModule('ui/app-extension-ui-browser-actions.ts'));

// The shape a runtime's open_workspace_file tool sends (Piclaw 3.2.5 open-workspace-file.ts via ctx.ui.custom).
const request = (chatJid: string, target = 'tab') => ({
    kind: 'custom', request_id: 'req-1', chat_jid: chatJid,
    options: { action: 'open_workspace_file', path: 'notes/a.md', target, timeout: 15000 },
});

function host(chatJid: string) {
    const opened: string[] = [];
    const answers: any[] = [];
    const target = new EventTarget();
    target.addEventListener('piclaw-extension-ui:request', event => void handleOpenWorkspaceFileBrowserRequest(event as CustomEvent, {
        currentChatJid: chatJid,
        openEditor: path => opened.push(path),
        popOutPane: () => true,
        respond: async (requestId, outcome, jid) => { answers.push({ requestId, outcome, jid }); },
        windowObject: { innerWidth: 390, innerHeight: 800, screen: { availWidth: 390, availHeight: 800 } },
    }));
    (globalThis as any).window = target;
    return { opened, answers };
}

test("an extension_ui_request for this chat's open_workspace_file opens a tab and answers the request", async () => {
    const { opened, answers } = host('gi:one');
    setPlanSidebarChat('gi:one');
    forwardPlanSidebarEvent('extension_ui_request', request('gi:one'));
    await Bun.sleep(0);
    expect(opened).toEqual(['notes/a.md']);
    expect(answers).toEqual([{ requestId: 'req-1', jid: 'gi:one', outcome: { ok: true, opened: true, target: 'tab', path: 'notes/a.md' } }]);
});

test("another chat's request is not opened, and a popout that does not fit is refused", async () => {
    const { opened, answers } = host('gi:one');
    setPlanSidebarChat('gi:one');
    forwardPlanSidebarEvent('extension_ui_request', request('gi:two'));
    forwardPlanSidebarEvent('extension_ui_request', request('gi:one', 'popout'));
    await Bun.sleep(0);
    expect(opened).toEqual([]);
    expect(answers.map(a => a.outcome.reason)).toEqual(['insufficient_screen_space']);
});
