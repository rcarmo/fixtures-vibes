// Focused Classic component acceptance; builds from source into run-owned memory,
// never rewrites the committed bundle. Run only through make check-appearance-identity.
import { chromium, expect } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { piclawWebAdapter } from './piclaw-web.mjs';
const root = resolve(import.meta.dir, '..');
const run = resolve(process.env.FIXTURES_RUN_ROOT || '/invalid');
const project = resolve(process.env.PROJECT_TMP_ROOT || '/invalid');
if (!run.startsWith(project + '/runs/')) throw Error('Use the Makefile project environment');
const scratch = join(run, 'appearance-identity'); mkdirSync(scratch, { recursive: true });
const entry = join(scratch, 'entry.ts');
writeFileSync(entry, `
import {html,render} from '${root}/src/vendor/preact-htm-entry.ts';
import {Appearance} from '${root}/src/gi-settings-appearance.ts';
import {InstanceConfig} from '${root}/src/gi-settings-instance.ts';
import {Timeline} from '${root}/piclaw/web-3.3.4/web/src/components/timeline.ts';
import {timelineAgents,activeSessionTitle} from '${root}/src/gi-post-identity.ts';
import {buildTerminalTheme} from '${root}/piclaw/web-3.3.4/web/src/panes/terminal-pane.ts';
window.checkTerminal=async(dark)=>{
 document.documentElement.style.setProperty('--bg-terminal',dark?'#0d1117':'#ffffff');
 document.documentElement.style.setProperty('--bg-primary',dark?'#0d1117':'#ffffff');
 document.documentElement.style.setProperty('--text-primary',dark?'#e7e9ea':'#0f1419');
 const {Terminal}=await import('/common/js/vendor/xterm/xterm.mjs');
 const theme=buildTerminalTheme();
 const terminal=new Terminal({allowProposedApi:true,cols:30,rows:6,overviewRuler:{width:2},theme});
 terminal.open(document.querySelector('#terminal'));
 await new Promise(resolve=>terminal.write(Array.from({length:30},(_,i)=>'line '+i+'\\r\\n').join(''),resolve));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const ruler=document.querySelector('#terminal .xterm-decoration-overview-ruler');
 const pixel=Array.from(ruler.getContext('2d').getImageData(0,Math.floor(ruler.height/2),1,1).data);
 terminal.scrollToTop();const scrolled=terminal.buffer.active.viewportY===0;
 terminal.dispose();return {border:theme.overviewRulerBorder,background:theme.background,pixel,scrolled};
};
window.mount=(session='first',search=false,selected='gi:a')=>{
 const entries=[{agent_id:'agent',chat_jid:'gi:a',agent_name:session},{agent_id:'agent',chat_jid:'gi:b',agent_name:'second'}];
 document.title=activeSessionTitle(selected,entries);
 const agents={...timelineAgents(entries,{assistant_name:'Configured Assistant',assistant_avatar:null}),__gi_system__:{id:'__gi_system__',name:'System'}};
 const posts=[['assistant','agent_response','agent','gi:a'],['other','agent_response','agent','gi:b'],['user','user',null,'gi:a'],['system','agent_response','__gi_system__','gi:a']].map(([id,type,agent_id,chat_jid])=>({id,chat_jid,timestamp:new Date().toISOString(),chat_agent_name:search&&id==='assistant'?'search-source':undefined,data:{type,agent_id,content:'Hello fixture'}}));
 render(html\`<\$\{Appearance} />\`,document.querySelector('#appearance'));
 render(html\`<\$\{Timeline} posts=\$\{posts} agents=\$\{agents} user=\$\{{name:'Reader'}} searchQuery=\$\{search?'Hello':''} onMessageRef=\$\{()=>{window.references++;}} />\`,document.querySelector('#timeline'));
};window.references=0;window.mount();
render(html\`<\$\{InstanceConfig} />\`,document.querySelector('#instance'));
window.unmountInstance=()=>render(null,document.querySelector('#instance'));
`);
try {
 const bundle = await Bun.build({entrypoints:[entry],target:'browser',format:'esm',external:['/common/js/vendor/xterm/xterm.mjs'],plugins:[{name:'fixture-vendor',setup(build){
  build.onResolve({filter:/vendor\/preact-htm\.js$/},()=>({path:join(root,'src/vendor/preact-htm-entry.ts')}));
 }},piclawWebAdapter(root),{name:'fixture-theme',setup(build){
  build.onLoad({filter:/\/ui\/theme\.ts$/},async args=>({contents:(await Bun.file(args.path).text())+'\nexport { THEME_PRESETS as giThemePresets, applyThemeState as giApplyThemeState };',loader:'ts'}));
 }}]});
 if(!bundle.success) throw Error(bundle.logs.join('\n'));
 const javascript=await bundle.outputs[0].text();
 const server=Bun.serve({port:0,hostname:'127.0.0.1',async fetch(req){
  const path=new URL(req.url).pathname;
  if(path==='/entry.js')return new Response(javascript,{headers:{'Content-Type':'text/javascript'}});
  if(path==='/')return new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/dist/app.bundle.css"><link rel="stylesheet" href="/css/gi-settings.css"><link rel="stylesheet" href="/common/js/vendor/xterm/xterm.css"></head><body><div id="terminal" style="width:320px;height:140px"></div><div id="instance" class="settings-content"></div><div id="appearance" class="settings-content"></div><div id="timeline"></div><script type="module" src="/js/marked.min.js"></script><script type="module" src="/entry.js"></script></body></html>',{headers:{'Content-Type':'text/html'}});
  if(path==='/favicon.ico')return new Response(null,{status:204});
  if(path.startsWith('/api/'))return Response.json({});
  const file=resolve(root,'static','.'+path);
  return file.startsWith(join(root,'static')+'/')&&await Bun.file(file).exists()?new Response(Bun.file(file)):new Response('',{status:404});
 }});
 try {
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  try {
   for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    let general:any={workspaceUploadLimitMb:256,maxIterations:128};
    const writes:any[]=[];let failSave=false;
    await page.route('**/api/settings/general',async route=>{
      if(route.request().method()==='POST'){
        const patch=route.request().postDataJSON();writes.push(patch);
        if(failSave)return route.fulfill({status:503,json:{error:'Fixture save unavailable'}});
        general={...general,...patch};
      }
      return route.fulfill({json:{ok:true,settings:general}});
    });
    const profileDir=process.env.IDENTITY_BROWSER_PROFILE_DIR;
    const cdp=profileDir?await context.newCDPSession(page):null;
    if(cdp){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await cdp.send('HeapProfiler.enable');await cdp.send('HeapProfiler.startSampling',{samplingInterval:16384,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});}
    try {
    await page.goto(server.url.origin);
    await expect(page).toHaveTitle('@first — Gi');
    const iterations=page.getByRole('textbox',{name:'Maximum iterations',exact:true});
    const upload=page.getByRole('textbox',{name:'Upload limit (MB)',exact:true});
    await expect(iterations).toHaveValue('128');
    await iterations.fill('32');await iterations.press('Tab');
    await expect(page.locator('.settings-general-applied-notice')).toContainText('subsequent turns');
    expect(writes).toEqual([{maxIterations:32}]);
    await upload.fill('64');await upload.press('Tab');
    await expect.poll(()=>general.workspaceUploadLimitMb).toBe(64);
    expect(general.maxIterations).toBe(32);
    await page.reload();await expect(iterations).toHaveValue('32');await expect(upload).toHaveValue('64');
    failSave=true;
    await iterations.fill('33');await iterations.press('Tab');
    await expect(page.getByRole('alert')).toContainText('Fixture save unavailable');
    await expect(iterations).toHaveValue('32');failSave=false;
    const beforeClose=writes.length;
    await iterations.fill('34');await iterations.press('Tab');
    await page.evaluate(()=>(window as any).unmountInstance());
    await page.waitForTimeout(1000);expect(writes.length).toBe(beforeClose);
    general={workspaceUploadLimitMb:64};
    await page.reload();await expect(upload).toHaveValue('64');await expect(iterations).toHaveCount(0);
    general={workspaceUploadLimitMb:64,maxIterations:32};
    await page.reload();await expect(iterations).toHaveValue('32');
    const palettes=page.getByRole('img',{name:/palette$/});
    expect(await palettes.count()).toBeGreaterThan(10);
    await expect(page.getByRole('img',{name:'Default light palette',exact:true})).toBeVisible();
    await expect(page.getByRole('img',{name:'Default dark palette',exact:true})).toBeVisible();
    expect(await page.locator('.gi-theme-palette').first().locator('span').count()).toBe(8);
    expect(await page.locator('.gi-theme-palette span').first().evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    for(const palette of await palettes.all())await expect(palette).toBeVisible();
    expect(await page.locator('#appearance').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.getByRole('radio',{name:'Monokai Original',exact:true}).check();
    await expect(page.getByRole('radio',{name:'Monokai Original',exact:true})).toBeChecked();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gi_browser_appearance_v1')||'{}').theme)).toBe('monokai');
    const assistant=page.locator('#post-assistant');
    await expect(assistant.locator('.post-author')).toHaveText('Configured Assistant');
    await expect(assistant.locator('.post-session-tag')).toHaveText('@first');
    await expect(page.locator('#post-other .post-session-tag')).toHaveText('@second');
    await expect(page.locator('#post-user .post-author')).toHaveText('Reader');
    await expect(page.locator('#post-system .post-author')).toHaveText('System');
    await expect(page.locator('#post-user .post-session-tag, #post-system .post-session-tag')).toHaveCount(0);
    await page.evaluate(()=>(window as any).mount('renamed'));
    await expect(assistant.locator('.post-author')).toHaveText('Configured Assistant');
    await expect(assistant.locator('.post-session-tag')).toHaveText('@renamed');
    await expect(page).toHaveTitle('@renamed — Gi');
    await page.evaluate(()=>(window as any).mount('renamed',false,'gi:b'));
    await expect(page).toHaveTitle('@second — Gi');
    await page.evaluate(()=>(window as any).mount('renamed',true));
    await expect(page).toHaveTitle('@renamed — Gi');
    await expect(assistant.locator('.post-chat-agent-tag')).toHaveCount(1);
    await expect(assistant.getByRole('button',{name:'@search-source'})).toBeVisible();
    await assistant.getByRole('button',{name:'@search-source'}).click();
    expect(await page.evaluate(()=>(window as any).references)).toBe(1);
    for(const dark of [false,true]){
      const result=await page.evaluate(dark=>(window as any).checkTerminal(dark),dark);
      expect(result.border).toBe(result.background);
      expect(result.pixel).toEqual(dark?[13,17,23,255]:[255,255,255,255]);
      expect(result.scrolled).toBe(true);
    }
    expect(errors).toEqual([]);console.log('PASS width='+width+': palettes, persistence, identity, rename, tab title, user/system, search reference, terminal ruler, maximum iteration default/autosave/reopen/error/unmount');
    } finally {
      if(cdp&&profileDir){
        const cpu=await cdp.send('Profiler.stop');const heap=await cdp.send('HeapProfiler.stopSampling');
        writeFileSync(join(profileDir,`identity-${width}.cpuprofile`),JSON.stringify(cpu.profile));
        writeFileSync(join(profileDir,`identity-${width}.heapprofile`),JSON.stringify(heap.profile));
      }
      await context.close();
    }
   }
  }finally{await browser.close();}
 }finally{server.stop(true);}
}finally{rmSync(scratch,{recursive:true,force:true});}
