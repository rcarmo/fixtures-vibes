import { expect, test } from 'bun:test';
import { patchWidgetMessageSource, patchWidgetSandbox } from '../../../scripts/patch-widget-isolation.mjs';

const read = (p: string) => Bun.file(new URL(`../../../web/src/${p}`, import.meta.url)).text();

test('interactive widgets lose same-origin access; static widgets keep downloads only', async () => {
  const patched = patchWidgetSandbox(await read('ui/generated-widget.ts'));
  expect(patched).toContain("? 'allow-downloads allow-scripts'");
  expect(patched).not.toContain('allow-same-origin');
  expect(patched).toContain(": 'allow-downloads';");
});

test('bridge messages are accepted only from the widget iframe', async () => {
  const patched = patchWidgetMessageSource(await read('components/floating-widget-pane.ts'));
  expect(patched).toContain('if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;');
  expect(patched).not.toContain('if (!incomingKey && iframe?.contentWindow');
});

test('patches fail loudly when their anchors move', () => {
  expect(() => patchWidgetSandbox('nothing here')).toThrow(/anchor/);
  expect(() => patchWidgetMessageSource('nothing here')).toThrow(/anchor/);
});
