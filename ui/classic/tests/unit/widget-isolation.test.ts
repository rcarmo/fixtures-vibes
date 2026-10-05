import { expect, test } from 'bun:test';
import { patchWidgetMessageSource, patchWidgetSandbox } from '../../scripts/patch-widget-isolation.mjs';
import { piclawModule } from './piclaw-module';

const read = (p: string) => Bun.file(piclawModule(p)).text();

test('interactive widgets lose same-origin access; static widgets keep downloads only', async () => {
  const patched = patchWidgetSandbox(await read('ui/generated-widget.ts'));
  expect(patched).toContain("? 'allow-downloads allow-scripts allow-forms'");
  expect(patched).not.toMatch(/'[^'\n]*allow-same-origin[^'\n]*'/); // the supplied comment still names it
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
