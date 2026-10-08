// Adapter integration checks with an isolated HTTP fixture (not runtime compliance or oracle evidence).
// Run via `make check-revisions`; all generated files stay in FIXTURES_RUN_ROOT and are removed on exit.
import { chromium, webkit, expect } from '@playwright/test';
import { join, resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { piclawWebAdapter } from './piclaw-web.mjs';
import { piclawPlanSidebarAdapter } from './piclaw-plan-sidebar-adapter.mjs';
const root = resolve(import.meta.dir, '..');
const run = process.env.FIXTURES_RUN_ROOT;
if (!run || !process.env.PROJECT_TMP_ROOT || !resolve(run).startsWith(resolve(process.env.PROJECT_TMP_ROOT) + '/runs/')) throw Error('Use make check-revisions (owned FIXTURES_RUN_ROOT required)');
const planBundle = join(run, 'plan-browser.js');
const built = await Bun.build({ entrypoints: [join(root, 'piclaw/plan-sidebar-0.1.25/index.ts')], target: 'browser', format: 'esm', external: ['/editor-vendor/codemirror.js'], plugins: [piclawPlanSidebarAdapter(), piclawWebAdapter(root)] });
if (!built.success) throw new AggregateError(built.logs);
await Bun.write(planBundle, built.outputs[0]);
let file: any, plan: any, writes: any[], hold = false, release: (() => void) | null = null, complete = true;
function reset() { file = {text:'original',revision:'file-0',mtime:'unchanged',truncated:false}; plan = {markdown:'- [ ] original',revision:0}; writes=[]; hold=false; complete=true; release?.(); release=null; }
reset();
const json = (data: any, status = 200) => Response.json(data, {status});
const server = Bun.serve({hostname:'127.0.0.1',port:0, async fetch(req) {
  const url = new URL(req.url);
  if (url.pathname === '/fixture') {
    const body = await req.json();
    if (body.reset) reset();
    if (body.remoteFile) file = {...file,text:body.remoteFile,revision:'external-' + file.revision};
    if (body.remotePlan) plan = {...plan,markdown:body.remotePlan,revision:plan.revision+1};
    if ('complete' in body) complete=body.complete;
    if ('hold' in body) hold=body.hold;
    if (body.release) { release?.(); release=null; }
    return json({file,plan,writes});
  }
  if (url.pathname === '/api/workspace/file') {
    if (req.method === 'GET') return json({...file,revision:complete?file.revision:undefined,truncated:!complete});
    const body = await req.json(); writes.push({type:'file',...body});
    if (hold) await new Promise<void>(resolve => {release=resolve;});
    if (req.method === 'POST') {
      if (body.name === 'a.md') return json({error:'exists',code:'file_exists'},409);
      return json({revision:'copy',mtime:file.mtime});
    }
    if (body.expected_revision !== file.revision) return json({error:'stale file',code:'revision_conflict',revision:file.revision},409);
    file = {...file,text:body.content,revision:'saved-'+file.revision}; return json({revision:file.revision,mtime:file.mtime});
  }
  if (url.pathname === '/api/workspace/stat') return json({mtime:file.mtime});
  if (url.pathname === '/api/workspace/tree') return json({entries:[]});
  if (url.pathname === '/api/sessions/A/plan') {
    if (req.method === 'GET') return json({plan:{...plan,revision:complete?plan.revision:undefined}});
    const body=await req.json();writes.push({type:'plan',...body});
    if (hold) await new Promise<void>(resolve=>{release=resolve;});
    if (body.expected_revision!==plan.revision) return json({error:'stale plan',code:'plan_revision_conflict',revision:plan.revision},409);
    plan={markdown:body.action==='reset'?'- [ ] default':body.markdown,revision:plan.revision+1};return json({plan});
  }
  if (url.pathname === '/api/sessions/A/prompt') { writes.push({type:'prompt',...await req.json()});return json({ok:true}); }
  if (url.pathname === '/plan-browser.js') return new Response(Bun.file(planBundle),{headers:{'Content-Type':'text/javascript'}});
  if (url.pathname === '/harness') return new Response(`<!doctype html><html><head><link rel="stylesheet" href="/dist/app.bundle.css"></head><body><div id="editor"></div><script type="module">
    const params=new URLSearchParams(location.search);
    if(params.get('mode')==='plan') {
      localStorage.setItem('piclaw:plan-sidebar:open','true');
      window.__piclaw_web={getCurrentChatJid:()=> 'gi:A'};
      await import('/plan-browser.js');
    } else {
      const {editorPaneExtension}=await import('/dist/editor.bundle.js');
      window.editor=await editorPaneExtension.mount(document.querySelector('#editor'),{path:'notes/a.md',mode:'edit',transferState:params.has('transfer')?JSON.parse(localStorage.getItem('transfer')):undefined});
      window.addEventListener('pagehide',()=>window.editor.dispose());
    }
  </script></body></html>`,{headers:{'Content-Type':'text/html'}});
  const path = resolve(root, 'static', '.'+url.pathname);
  if (!path.startsWith(join(root,'static')+'/')) return new Response('',{status:403});
  const data=Bun.file(path);
  return await data.exists()?new Response(data):new Response('',{status:404});
}});
const origin=server.url.origin;
const fixture=async(body:any)=>{const response=await fetch(origin+'/fixture',{method:'POST',body:JSON.stringify(body)});return response.json();};
let passed=0;
try {
  for (const [name,browserType,viewport] of [['chromium-desktop',chromium,{width:1440,height:900}],['webkit-phone',webkit,{width:390,height:844}]] as const) {
    const browser=await browserType.launch({headless:true});
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors:string[]=[];page.on('pageerror',err=>{errors.push(err.message);console.error(name,err.message);});
    const profileDir = process.env.REVISION_BROWSER_PROFILE_DIR;
    const profiler = profileDir && browserType === chromium ? await context.newCDPSession(page) : null;
    if (profiler) {
      await profiler.send('Profiler.enable'); await profiler.send('Profiler.start');
      await profiler.send('HeapProfiler.enable'); await profiler.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    }
    try {
      await fixture({reset:true}); await page.goto(origin+'/harness');
      await expect(page.locator('.cm-content')).toHaveText('original');
      const edit=async(text:string)=>{const cm=page.locator('.cm-content').first();await cm.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text);};
      const save=page.getByRole('button',{name:/^Save(?: \(Ctrl\+S\))?$/});
      await edit('captured');await fixture({hold:true});await save.click();
      await expect.poll(()=>writes.length).toBe(1);await edit('newer');await fixture({hold:false,release:true});
      await expect(page.locator('.editor-status-text')).toContainText('newer changes');
      expect(writes[0].expected_revision).toBe('file-0');await expect(page.locator('.cm-content')).toHaveText('newer');
      // Carry baseline+revision through a fresh host, not just the retained live instance.
      const transfer=await page.evaluate(()=> (window as any).editor.exportHostTransferState());
      expect(transfer.initialContent).toBe('captured');expect(transfer.revision).toBe('saved-file-0');
      await page.evaluate(value=>localStorage.setItem('transfer',JSON.stringify(value)),transfer);
      await page.goto(origin+'/harness?transfer=1');await expect(page.locator('.cm-content')).toHaveText('newer');
      await fixture({remoteFile:'remote with same mtime'});await save.click();
      await expect(page.locator('.editor-conflict-bar')).toBeVisible();await expect(page.locator('.cm-content')).toHaveText('newer');
      const beforeCopy=writes.length;await page.getByRole('button',{name:'Save copy',exact:true}).click();await expect.poll(()=>writes.length).toBe(beforeCopy+1);
      expect(writes.at(-1).name).not.toBe('a.md');expect(writes.at(-1).expected_revision).toBeUndefined();
      await page.getByRole('button',{name:'Overwrite',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'Review overwrite'})).toBeVisible();
      await expect(page.getByLabel('Current saved content')).toHaveValue('remote with same mtime');
      // A second writer during review defeats this exact reviewed revision.
      await fixture({remoteFile:'changed during review'});await page.getByRole('button',{name:'Overwrite reviewed revision'}).click();
      await expect(page.locator('.editor-conflict-bar')).toBeVisible();expect(file.text).toBe('changed during review');
      await page.getByRole('button',{name:'Overwrite',exact:true}).click();await page.getByRole('button',{name:'Overwrite reviewed revision'}).click();
      await expect(page.locator('.editor-status-text')).toContainText('All changes saved');expect(file.text).toBe('newer');
      await fixture({complete:false});await page.goto(origin+'/harness');await expect(page.locator('.cm-content')).toHaveText('newer');await edit('unsaved');await expect(save).toBeDisabled();
      console.log(`PASS ${name}: editor conditional saves, pending typing, transferred baseline, immediate 409, create-only copy, reviewed overwrite, missing revision`);passed++;
      await fixture({reset:true});await page.goto(origin+'/harness?mode=plan');
      const panel=page.getByRole('complementary',{name:'Session plan'});await expect(panel).toBeVisible();
      await expect(page.locator('.cm-content')).toHaveText('- [ ] original');await edit('- [ ] captured');
      await fixture({hold:true});await page.getByRole('button',{name:'Submit to model',exact:true}).click();await expect.poll(()=>writes.length).toBe(1);await edit('- [ ] newer');await fixture({hold:false,release:true});
      await expect(page.locator('.plan-sidebar-status')).toContainText('save again');expect(writes[0].expected_revision).toBe(0);expect(writes.filter(w=>w.type==='prompt')).toHaveLength(0);
      await fixture({remotePlan:'- [ ] remote'});await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.plan-sidebar-status')).toContainText('conflict');await expect(page.locator('.cm-content')).toHaveText('- [ ] newer');
      page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('.cm-content')).toHaveText('- [ ] newer');
      page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('.cm-content')).toHaveText('- [ ] remote');
      await edit('- [ ] ready');await page.getByRole('button',{name:'Submit to model',exact:true}).click();await expect(page.locator('.plan-sidebar-status')).toContainText('Submitted');expect(writes.at(-1).type).toBe('prompt');
      await fixture({hold:true});page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Reset',exact:true}).click();await expect.poll(()=>writes.at(-1).action).toBe('reset');await edit('- [ ] during reset');await fixture({hold:false,release:true});await expect(page.locator('.plan-sidebar-status')).toContainText('newer edits');await expect(page.locator('.cm-content')).toHaveText('- [ ] during reset');
      await fixture({complete:false});await page.goto(origin+'/harness?mode=plan');await expect(page.locator('.plan-sidebar-status')).toContainText('read-only');await edit('unsaved');await expect(page.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
      expect(errors).toEqual([]);
      console.log(`PASS ${name}: Plan loaded integer revision, held-save Submit abort, conflict draft, refresh confirmation, conditional reset, missing revision`);passed++;
    } finally {
      if (profiler) {
        const cpu = await profiler.send('Profiler.stop');
        const heap = await profiler.send('HeapProfiler.stopSampling');
        await Bun.write(join(profileDir!, name + '.cpuprofile'), JSON.stringify(cpu.profile));
        await Bun.write(join(profileDir!, name + '.heapprofile'), JSON.stringify(heap.profile));
        await profiler.detach();
      } else if (profileDir) console.log(`${name}: browser CPU/allocation capture unavailable through Playwright; functional acceptance only`);
      await context.close();await browser.close();
    }
  }
  console.log(`${passed}/4 adapter browser workloads passed (zero retries; isolated fixture, no runtime/oracle claims)`);
} finally { release?.();server.stop(true);await rm(planBundle,{force:true}); }
