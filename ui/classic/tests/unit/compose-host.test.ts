import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { patchComposeHost } from '../../scripts/patch-compose-host.mjs';
import { piclawModule } from './piclaw-module';
const source = readFileSync(piclawModule('components/compose-box.ts'), 'utf8');

test('current composer keeps native rendering with batch cancellation, authoritative pins and IME safety', () => {
  const patched = patchComposeHost(source);
  const render = '        <div class="compose-box" data-testid="compose-box"';
  expect(source.indexOf(render)).toBeGreaterThan(0);
  expect(patched.indexOf(render)).toBeGreaterThan(0);
  const resizeBinding = '                tabIndex="0"\n                onKeyDown=${handleComposeResizeKey}\n';
  const nativeRender = patched.slice(patched.indexOf(render)).replace(resizeBinding, '')
    .replace('                                aria-haspopup="listbox"\n                                aria-expanded=${showModelPopup ? "true" : "false"}\n                                aria-controls=${showModelPopup ? "compose-model-results-host" : undefined}\n', '')
    .replace('                            instanceKey="host"\n                            supportsThinking=${supportsThinking}\n', '')
    .replace("window.dispatchEvent(new CustomEvent('piclaw:open-settings', {detail: {section: 'models', opener: modelHintRef.current}}));", "requestOpenSettingsDialog({ section: 'models' });")
    .replace('role=${speechUiState.kind === "error" ? "alert" : "status"}', 'role="status"')
    .replace('                            aria-pressed=${speechButtonActive ? "true" : "false"}\n', '');
  expect(nativeRender).toBe(source.slice(source.indexOf(render)));
  expect(patched).toContain('speechRecognitionRef.current=null;');
  expect(patched).toContain('if (speechPendingStopRef.current) recognition.stop();');
  expect(patched).toContain('current: () => textarea.isConnected && resizeChatRef.current===chat');
  expect(patched).toContain("['ArrowUp','ArrowDown','Home','End']");
  expect(patched).toContain('beginUploadBatch?.(submissionChatJid)');
  expect(patched.indexOf('await composeServices.captureSubmission?.')).toBeLessThan(patched.indexOf("setContent('');", patched.indexOf('await composeServices.captureSubmission?.')));
  expect(patched).toContain('client_request_id: hostCapture.token');
  expect(patched).toContain('await composeServices.acceptSubmission?.');
  expect(patched).toContain('useConnectionStatusPresentation(connectionStatus)');
  const clearFence = patched.indexOf('if (textareaRef.current) textareaRef.current.value = "";');
  expect(clearFence).toBeGreaterThan(patched.indexOf('await composeServices.captureSubmission?.'));
  expect(patched.slice(clearFence)).toMatch(/textareaRef.current.value = "";\s+onContentChange\?\.\(''\);\s+setContent\(''\)/);
  expect(patched).toContain('e.target?.closest?.(".compose-session-popup-close")');
  expect(patched).toContain('resolvePopupTypeaheadMatch(currentSessionPopupEntries, nextBuffer.value, -1, (item) => item.label)');
  expect(patched).toContain('composeServices.failSubmission?.');
  expect(patched.match(/uploadBatch\?\.signal.throwIfAborted\(\)/g)).toHaveLength(2);
  expect(patched).toContain('signal: uploadBatch?.signal');
  expect(patched).toContain('await composeServices.pinSession(chatJid, pinned)');
  expect(patched).toContain('togglePinnedSessionChatJid(chatJid, sessionPreferenceRuntime)');
  expect(patched).toContain('e.keyCode === 229');
  expect(patched).toContain('if (event.target === textareaRef.current) return;');
  expect(patched).toContain('activeChatAgents.filter(chat => chat.pinned && !chat.archived_at)');
  expect(readFileSync(piclawModule('components/compose-box.ts'), 'utf8')).toBe(source);
});

test('compose host adaptation rejects missing, duplicate and already adapted anchors', () => {
  for (const changed of ['', source + source, patchComposeHost(source), source.replace('const handleKeyDown =', 'const changed =')]) {
    expect(() => patchComposeHost(changed)).toThrow(/anchor changed/);
  }
});

test('shell uses supported native compose props and captures the upload destination in its service closure', () => {
  const app = readFileSync('src/app.ts', 'utf8');
  expect(app).toContain('uploadMedia(file, currentChatJid, options)');
  expect(app).toContain('draftValue=${initialComposeDraft}');
  expect(app).not.toContain('onCaptureDraft=');
  expect(app).not.toContain('draftMediaFiles=');
  expect(app).not.toContain('RunBoundQueueStack');
  expect(app).not.toContain('useContextTooltip');
});
