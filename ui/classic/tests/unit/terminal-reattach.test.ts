import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {patchTerminalReattach} from '../../scripts/patch-terminal-reattach.mjs';
const source=readFileSync(new URL('../../piclaw/web-3.3.0/web/src/ui/app-pane-runtime-orchestration.ts',import.meta.url),'utf8');
function guards(text:string){
 const start=text.indexOf('export function isLikelySafariBrowser');const end=text.indexOf('function shouldUseLivePaneTransfer',start);
 const js=new Bun.Transpiler({loader:'ts'}).transformSync(text.slice(start,end)).replaceAll('export ','');
 return new Function(`${js};return {shouldDisableTerminalReattach,shouldRequireManualTerminalCloseRecovery,shouldDelayPaneReattachAfterWindowClose};`)();
}
const safari={userAgent:'AppleWebKit Safari',vendor:'Apple Computer, Inc.'};
test('Gi permits terminal close recovery in WebKit while retaining recovery delay',()=>{
 const original=guards(source),adapted=guards(patchTerminalReattach(source));
 const opts={panePath:'piclaw://terminal',terminalTabPath:'piclaw://terminal',runtimeNavigator:safari,reason:'closed-window'};
 expect(original.shouldDisableTerminalReattach(opts)).toBe(true);
 expect(original.shouldRequireManualTerminalCloseRecovery(opts)).toBe(true);
 expect(adapted.shouldDisableTerminalReattach(opts)).toBe(false);
 expect(adapted.shouldRequireManualTerminalCloseRecovery(opts)).toBe(false);
 expect(adapted.shouldDelayPaneReattachAfterWindowClose(opts)).toBe(true);
 expect(adapted.shouldDelayPaneReattachAfterWindowClose({...opts,panePath:'file.md'})).toBe(false);
 expect(patchTerminalReattach(source)).toContain('if (expectedHandle && event.source !== expectedHandle) return;');
});
test('terminal guard adaptation rejects missing/duplicate/already patched anchors',()=>{
 expect(()=>patchTerminalReattach('drift')).toThrow();
 expect(()=>patchTerminalReattach(source+source)).toThrow();
 expect(()=>patchTerminalReattach(patchTerminalReattach(source))).toThrow();
});
