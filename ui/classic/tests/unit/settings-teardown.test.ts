import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
test('settings restores focus from modal cleanup after releasing inert',()=>{
 const source=readFileSync(new URL('../../src/gi-settings.ts',import.meta.url),'utf8');
 expect(source).toContain('onDismissed?.();');
 expect(source.indexOf('if (app) app.inert = previousInert || false;')).toBeLessThan(source.indexOf('onDismissed?.();'));
 expect(source).toContain('onDismissed=${restoreFocus}');
 expect(source).toContain('const close = () => { isOpen.current = false; setOpen(false); };');
});
