import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {writeClipboardTextBestEffort,writeClipboardDataViaExecCommand} from '../../src/gi-clipboard-safety';

test('missing or denied native clipboard cannot claim a successful write',async()=>{
 for(const value of [undefined,null,{}, {writeText:undefined}, {get writeText(){throw new Error('blocked getter')}}])expect(await writeClipboardTextBestEffort(value,'source')).toBe(false);
 expect(await writeClipboardTextBestEffort({writeText:async()=>{throw new Error('denied')}},'source')).toBe(false);
 const target={calls:[] as string[],async writeText(value:string){this.calls.push(value)}};
 expect(await writeClipboardTextBestEffort(target,'**source**')).toBe(true);expect(target.calls).toEqual(['**source**']);
});
test('build routes the actual vendored post importer through the clipboard guard',()=>{
 const build=readFileSync(new URL('../../build.js',import.meta.url),'utf8');
 expect(build).toContain("args.importer === resolve(PICLAW_WEB, 'web/src/components/post.ts')");
 expect(build).not.toContain("args.importer === resolve(webSrc, 'components/post.ts')");
});
test('compatibility adapter retains supplied legacy helper exports',()=>{
 expect(writeClipboardDataViaExecCommand(undefined,{text:'source'})).toBe(false);
});
