import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { patchTerminalRuler } from '../../scripts/patch-terminal-ruler.mjs';

test('terminal ruler uses its background without disabling scrollback or search markers', () => {
    const source = readFileSync(new URL('../../piclaw/web-3.3.4/web/src/panes/terminal-pane.ts', import.meta.url), 'utf8');
    const patched = patchTerminalRuler(source);
    expect(patched).toContain('overviewRulerBorder: background,');
    expect(patched).toContain('overviewRuler: { width: 2 },');
    expect(patched).toContain('scrollback: 10_000,');
    expect(() => patchTerminalRuler('changed')).toThrow('anchor changed');
    expect(() => patchTerminalRuler(patched)).toThrow('anchor changed');
});
