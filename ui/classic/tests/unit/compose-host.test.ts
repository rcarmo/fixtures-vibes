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
  expect(patched.slice(patched.indexOf(render))).toBe(source.slice(source.indexOf(render)));
  expect(patched).toContain('beginUploadBatch?.(submissionChatJid)');
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
