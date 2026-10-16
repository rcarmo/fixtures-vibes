// Component-level release/dependency checks. The loopback fixture is not a runtime or oracle.
import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { piclawWebAdapter } from './piclaw-web.mjs';
import { patchAboutDialog } from './patch-about-dialog.mjs';
import { patchComposeHost } from './patch-compose-host.mjs';
import { patchMarkdownCode } from './gi-markdown-code-adapter.mjs';
const root = resolve(import.meta.dir, '..');
const project = resolve(process.env.PROJECT_TMP_ROOT || '/invalid');
const run = resolve(process.env.FIXTURES_RUN_ROOT || '/invalid');
if (!run.startsWith(project + '/runs/')) throw Error('Use make check-release with an isolated project run');
const scratch = join(run, 'release-browser');
mkdirSync(scratch, { recursive: true });
const entry = join(scratch, 'entry.ts');
writeFileSync(entry, `
import {html,render} from '${root}/src/vendor/preact-htm-entry.ts';
import {AboutDialog} from '${root}/piclaw/web-3.3.4/web/src/components/about-dialog.ts';
import {ComposeBox} from '${root}/piclaw/web-3.3.4/web/src/components/compose-box.ts';
import {FloatingWidgetPane} from '${root}/piclaw/web-3.3.4/web/src/components/floating-widget-pane.ts';
import {renderAdaptiveCard} from '${root}/piclaw/web-3.3.4/web/src/ui/adaptive-card-renderer.ts';
import {renderMarkdown} from '${root}/piclaw/web-3.3.4/web/src/markdown.ts';
window.mountAbout=()=>render(html\`<\$\{AboutDialog} onClose=\$\{()=>render(null,document.querySelector('#about'))} />\`,document.querySelector('#about'));
window.sent=[];window.widgetEvents=[];
window.runChecks=async()=>{
 document.querySelector('#markdown').innerHTML=renderMarkdown('**release**\\n\\n$$x^2$$\\n\\n[unsafe](javascript:alert(1))');
 render(html\`<\$\{ComposeBox} services=\$\{{sendAgentMessage:async(...args)=>{window.sent.push(args);return {user_message:{id:1}};},getAgentModels:async()=>[],fetchCommands:async()=>({commands:[]})}} currentChatJid="gi:fixture" onCancel=\$\{()=>{}} models=\$\{[]} agents=\$\{[]} />\`,document.querySelector('#compose'));
 const widget={kind:'html',source:'live',widget_id:'release',title:'Release widget',html:'<button id="submit" onclick="piclawWidget.submit({text: \\'widget reply\\'})">Submit widget</button>'};
 window.mountWidget=()=>render(html\`<\$\{FloatingWidgetPane} widget=\$\{widget} onClose=\$\{()=>render(null,document.querySelector('#widget'))} onWidgetEvent=\$\{event=>{if(event.kind==='widget.submit')window.widgetEvents.push(event);}} />\`,document.querySelector('#widget'));
 window.cardAction=null;
 window.cardRendered=await renderAdaptiveCard(document.querySelector('#card'),{type:'adaptive_card',card_id:'release-card',schema_version:'1.5',state:'active',payload:{type:'AdaptiveCard',version:'1.5',body:[{type:'TextBlock',text:'Release card'},{type:'Input.Text',id:'answer',placeholder:'Card answer'}],actions:[{type:'Action.Submit',title:'Submit card',data:{action:'accept'}}]}}, {onAction:async(action)=>{window.cardAction=action;}});
};
`);
const bundle = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm', plugins: [{ name: 'release-preact', setup(build) {
  build.onResolve({ filter: /vendor\/preact-htm\.js$/ }, () => ({ path: join(root, 'src/vendor/preact-htm-entry.ts') }));
} }, piclawWebAdapter(root), { name: 'release-adapters', setup(build) {
  build.onLoad({ filter: /components\/about-dialog\.ts$/ }, async args => ({ contents: patchAboutDialog(await Bun.file(args.path).text()), loader: 'ts' }));
  build.onLoad({ filter: /components\/compose-box\.ts$/ }, async args => ({ contents: patchComposeHost(await Bun.file(args.path).text()), loader: 'ts' }));
  build.onLoad({ filter: /web\/src\/markdown\.ts$/ }, async args => ({ contents: patchMarkdownCode(await Bun.file(args.path).text()), loader: 'ts' }));
} }] });
if (!bundle.success) throw Error(bundle.logs.join('\n'));
const javascript = await bundle.outputs[0].text();
const requests: string[] = [];
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
  const path = new URL(req.url).pathname; requests.push(path);
  if (path === '/favicon.ico') return new Response(null, { status: 204 });
  if (path === '/api/runtime/config') return Response.json({ version: 'fixture-runtime' });
  if (path === '/entry.js') return new Response(javascript, { headers: { 'Content-Type': 'text/javascript' } });
  if (path === '/harness') return new Response(`<!doctype html><html><head><link rel="stylesheet" href="/dist/app.bundle.css"><link rel="stylesheet" href="/css/katex.min.css"><link rel="stylesheet" href="/common/js/vendor/xterm/xterm.css"></head><body><button id="open-about">About</button><div id="about"></div><div id="markdown"></div><div id="compose"></div><div id="card"></div><div id="widget"></div><div id="terminal" style="height:200px;width:600px"></div><script type="module" src="/js/marked.min.js"></script><script type="module" src="/js/vendor/katex.min.js"></script><script type="module" src="/entry.js"></script></body></html>`, { headers: { 'Content-Type': 'text/html' } });
  const normalized = path.startsWith('/static/') ? path.slice('/static'.length) : path;
  const file = resolve(root, 'static', '.' + normalized);
  if (!file.startsWith(join(root, 'static') + '/')) return new Response('', { status: 403 });
  return await Bun.file(file).exists() ? new Response(Bun.file(file)) : new Response('', { status: 404 });
} });
try {
  for (const [name, type, viewport] of [['chromium-desktop', chromium, { width: 1440, height: 1000 }], ['webkit-phone', webkit, { width: 390, height: 844 }]] as const) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('console', message => { if (message.type() === 'error') console.error(name, message.text()); });
    const profileDir = process.env.RELEASE_BROWSER_PROFILE_DIR;
    const cdp = profileDir && type === chromium ? await context.newCDPSession(page) : null;
    if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
    try {
      await page.goto(server.url.origin + '/harness');
      await page.waitForFunction(() => typeof (window as any).runChecks === 'function');
      await page.evaluate(() => (window as any).runChecks());
      await expect(page.locator('#markdown strong')).toHaveText('release');
      await expect(page.locator('#markdown .katex')).toBeVisible();
      expect(await page.locator('#markdown a[href^="javascript:"]').count()).toBe(0);
      await page.evaluate(() => (window as any).mountAbout());
      await expect(page.getByRole('dialog', { name: 'About', exact: true })).toBeVisible();
      await expect(page.locator('.about-versions')).toContainText('fixture-runtime');
      await expect(page.locator('.about-versions')).toContainText('Piclaw v3.3.4-ux');
      await page.getByRole('button', { name: 'Close About', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'About', exact: true })).toHaveCount(0);
      const input = page.getByTestId('compose-input'); await input.fill('Release composer');
      await page.getByTestId('send-button').click();
      await expect.poll(() => page.evaluate(() => (window as any).sent.length)).toBe(1);
      expect(await page.evaluate(() => (window as any).sent[0][1])).toBe('Release composer');
      expect(await page.evaluate(() => (window as any).cardRendered)).toBe(true);
      await page.getByPlaceholder('Card answer').fill('accepted');
      await page.getByRole('button', { name: 'Submit card', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as any).cardAction?.data?.answer)).toBe('accepted');
      await page.evaluate(() => (window as any).mountWidget());
      const iframe = page.locator('#widget iframe');
      expect(await iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
      await page.frameLocator('#widget iframe').locator('#submit').click();
      await expect.poll(() => page.evaluate(() => (window as any).widgetEvents.length)).toBe(1);
      await page.evaluate(() => window.postMessage({ __piclawGeneratedWidget: true, kind: 'widget.submit', payload: { text: 'forged' } }, '*'));
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => (window as any).widgetEvents.length)).toBe(1);
      await page.evaluate(async () => {
        const { Terminal } = await import('/common/js/vendor/xterm/xterm.mjs');
        const { FitAddon } = await import('/common/js/vendor/xterm/addon-fit.mjs');
        const terminal = new Terminal(); const fit = new FitAddon(); terminal.loadAddon(fit);
        terminal.open(document.querySelector('#terminal')); fit.fit();
        await new Promise<void>(resolve => terminal.write('Release terminal\r\n', resolve));
        (window as any).terminalLine = terminal.buffer.active.getLine(0)?.translateToString(true);
        terminal.dispose();
      });
      expect(await page.evaluate(() => (window as any).terminalLine)).toBe('Release terminal');
      expect(errors).toEqual([]);
      console.log(`PASS ${name}: markdown/math sanitization, About, composer, AdaptiveCards input/submit, isolated widget bridge, xterm/fit`);
    } finally {
      if (cdp && profileDir) { const cpu = await cdp.send('Profiler.stop'); const heap = await cdp.send('HeapProfiler.stopSampling'); writeFileSync(join(profileDir, `release-${name}.cpuprofile`), JSON.stringify(cpu.profile)); writeFileSync(join(profileDir, `release-${name}.heapprofile`), JSON.stringify(heap.profile)); }
      await context.close(); await browser.close();
    }
  }
  expect(requests).not.toContain('/agent/about');
  console.log('2/2 release component workloads passed (zero retries; isolated fixture only)');
} finally { server.stop(true); rmSync(scratch, { recursive: true, force: true }); }
