import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getGeneratedWidgetSandbox } from '../../piclaw/web-3.3.4/web/src/ui/generated-widget-policy';

test('upstream interactive widgets exclude same-origin; static widgets keep downloads only', () => {
  for (const widget of [{ kind: 'html', source: 'live' }, { kind: 'html', capabilities: ['interactive'] }]) {
    expect(getGeneratedWidgetSandbox(widget as any)).toBe('allow-downloads allow-scripts allow-forms');
    expect(getGeneratedWidgetSandbox(widget as any)).not.toContain('allow-same-origin');
  }
  expect(getGeneratedWidgetSandbox({ kind: 'html' } as any)).toBe('allow-downloads');
});

test('upstream bridge messages are accepted only from the widget iframe', () => {
  const source = readFileSync(new URL('../../piclaw/web-3.3.4/web/src/components/floating-widget-pane.ts', import.meta.url), 'utf8');
  expect(source).toContain('if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;');
  expect(source).not.toContain('event.source !== iframe.contentWindow && event.origin');
});
