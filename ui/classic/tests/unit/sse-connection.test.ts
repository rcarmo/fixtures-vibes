import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { patchSseConnection } from '../../scripts/patch-sse-connection.mjs';
import { piclawModule } from './piclaw-module';

const source = readFileSync(piclawModule('ui/use-sse-connection.ts'), 'utf8');

test('SSE adaptation adds pagehide teardown and selection gating to the supplied hook', () => {
  const out = patchSseConnection(source);
  expect(out).toContain("win.addEventListener('pagehide', handlePageHide);");
  expect(out).toContain("win.removeEventListener('pagehide', handlePageHide);");
  expect(out).toContain('selectionKey = chatJid');
  expect(out).toContain('}, [chatJid, selectionKey]);');
  expect(out.match(/selectionRef\.current === selectionKey/g)).toHaveLength(2);
});

test('SSE adaptation fails closed when applied twice or to drifted source', () => {
  expect(() => patchSseConnection(patchSseConnection(source))).toThrow(/anchor changed/);
  expect(() => patchSseConnection(source.replace('}, [chatJid]);', '}, [chatJid, other]);'))).toThrow(/anchor changed/);
});
