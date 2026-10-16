import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../piclaw/web-3.3.4/web/src/ui/app-pane-runtime-orchestration.ts', import.meta.url), 'utf8');

test('upstream terminal recovery is browser independent and retains delayed close recovery', () => {
  expect(source).not.toContain('shouldDisableTerminalReattach');
  expect(source).not.toContain('shouldRequireManualTerminalCloseRecovery');
  const start = source.indexOf('export function shouldDelayPaneReattachAfterWindowClose');
  const end = source.indexOf('function shouldUseLivePaneTransfer', start);
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(source.slice(start, end)).replaceAll('export ', '');
  const delay = new Function(`${js}; return shouldDelayPaneReattachAfterWindowClose;`)();
  const options = { panePath: 'piclaw://terminal', terminalTabPath: 'piclaw://terminal', reason: 'closed-window' };
  expect(delay(options)).toBe(true);
  expect(delay({ ...options, panePath: 'file.md' })).toBe(false);
  expect(delay({ ...options, reason: 'message', allowLiveTransfer: true })).toBe(false);
  expect(delay({ ...options, reason: 'message', allowLiveTransfer: false })).toBe(true);
});

test('upstream reattach validates source window and pane instance before consuming transfer', () => {
  const start = source.indexOf("if (payload.type !== 'piclaw-pane-reattach-request') return;");
  const end = source.indexOf('const transfer = consumePanePopoutReattachRequestMessage', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const admission = source.slice(start, end);
  expect(admission).toContain('if (!expectedHandle || event.source !== expectedHandle) return;');
  expect(admission).toContain('if (!ownedPane || payload.paneInstanceId !== ownedPane.paneInstanceId) return;');
});
