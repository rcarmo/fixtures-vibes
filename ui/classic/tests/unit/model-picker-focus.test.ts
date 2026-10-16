import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {patchModelPickerFocus} from '../../scripts/patch-model-picker-focus.mjs';

test('native picker defers opening-key focus and cancels stale unmount work',()=>{
 const source=readFileSync(new URL('../../piclaw/web-3.3.4/web/src/components/model-picker.ts',import.meta.url),'utf8');
 const patched=patchModelPickerFocus(source);
 expect(patched).toContain('requestAnimationFrame(() => searchRef.current?.focus())');
 expect(patched).toContain('return () => cancelAnimationFrame(frame)');
 expect(()=>patchModelPickerFocus(patched)).toThrow('anchor changed');
 expect(()=>patchModelPickerFocus(source+source)).toThrow('anchor changed');
});
