import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { patchPlanSidebar } from '../../scripts/piclaw-plan-sidebar-adapter.mjs';
import { validRevision, requireRevision, isRevisionConflict } from '../../src/gi-revision-state';
import { giPlanSidebarRequest } from '../../src/gi-plan-sidebar';
const source = readFileSync(new URL('../../piclaw/plan-sidebar-0.1.25/index.ts', import.meta.url), 'utf8');
const adapted = patchPlanSidebar(source);
function host(apiJson: Function) {
  const state: any = { chatJid: 'gi:A', requestEpoch: 0, editRevision: 0, revision: 0, markdown: '- [ ] base', baseline: '- [ ] base', dirty: false, pendingRemoteRefresh: false, pendingRemoteLabel: 'remote' };
  let nextChat = 'gi:A'; const drafts = new Map();
  const functions = adapted.slice(adapted.indexOf('  function planUrl('), adapted.indexOf('  toggle.addEventListener'));
  const exports = adapted.slice(adapted.indexOf('export function beginPlanRequest'), adapted.indexOf('if (!globalThis')) .replaceAll('export ', '');
  const methods = new Function('state', 'apiJson', 'validRevision', 'requireRevision', 'isRevisionConflict', 'renderChrome', 'setStatus', 'getEditorValue', 'setEditorValue', 'markDirty', 'formatTime', 'confirm', 'getCurrentChatJid', 'clearDisplayedPlan', 'drafts', `const API = '/agent/addons/api/plan-sidebar/plan';\n${exports}\n${functions}\nreturn {loadPlan, savePlan, resetPlan, submitToModel, updateChatJid};`)(
    state, apiJson, validRevision, requireRevision, isRevisionConflict, () => {}, (message) => { state.status = message; },
    () => state.markdown, (value) => { state.markdown = value; }, (dirty) => { state.dirty = dirty; }, () => 'now', () => true, () => nextChat,
    () => { state.markdown = ''; }, drafts,
  );
  return { state, ...methods, type(value) { state.markdown = value; state.dirty = true; state.editRevision++; }, switch(chat) { nextChat = chat; methods.updateChatJid(); } };
}
test('Plan writes preserve loaded integer revision and acknowledge only captured edits', async () => {
  let done: Function; const requests: any[] = [];
  const h = host((url, init) => { requests.push({url, body: JSON.parse(init.body)}); return new Promise(resolve => { done = resolve; }); });
  h.type('- [ ] captured'); const promise = h.savePlan(); h.type('- [ ] newer');
  done!({ plan: { markdown: '- [ ] captured', revision: 1 } }); await promise;
  expect(requests[0].body.expected_revision).toBe(0); expect(h.state.revision).toBe(1);
  expect(h.state.baseline).toBe('- [ ] captured'); expect(h.state.markdown).toBe('- [ ] newer'); expect(h.state.dirty).toBe(true);
});
test('Plan conflict on save and reset retains drafts and revisions; no implicit retry', async () => {
  let calls = 0; const h = host(async () => { calls++; throw Object.assign(new Error('stale'), { status: 409, code: 'plan_revision_conflict', revision: 99 }); });
  h.type('my plan'); await expect(h.savePlan()).rejects.toThrow('stale'); await expect(h.resetPlan()).rejects.toThrow('stale');
  expect(calls).toBe(2); expect(h.state.markdown).toBe('my plan'); expect(h.state.revision).toBe(0); expect(h.state.dirty).toBe(true); expect(h.state.status).toContain('conflict');
});
test('Reset acknowledgement leaves newer typing dirty against the new reset baseline', async () => {
  let done: Function; const h = host(() => new Promise(resolve => { done = resolve; }));
  const promise = h.resetPlan(); h.type('new typing'); done!({ plan: { markdown: 'default', revision: 1 } }); await promise;
  expect(h.state.revision).toBe(1); expect(h.state.baseline).toBe('default'); expect(h.state.markdown).toBe('new typing'); expect(h.state.dirty).toBe(true);
});
test('late Plan load cannot establish a baseline over text typed while loading', async () => {
  let done: Function; const h = host(() => new Promise(resolve => { done = resolve; })); h.state.revision = null;
  const load = h.loadPlan(); h.type('local'); done!({ markdown: 'remote', revision: 4 }); await load;
  expect(h.state.markdown).toBe('local'); expect(h.state.revision).toBeNull(); expect(h.state.dirty).toBe(true);
});
test('Plan acknowledgement without revision preserves draft and fails closed', async () => {
  let calls = 0; const h = host(async () => { calls++; return {plan:{markdown:'saved'}}; }); h.type('local');
  await expect(h.savePlan()).rejects.toThrow(/acknowledgement/); await expect(h.savePlan()).rejects.toThrow(/read-only/);
  expect(calls).toBe(1); expect(h.state.markdown).toBe('local'); expect(h.state.dirty).toBe(true);
});
test('Submit never sends when typing continued during the required save', async () => {
  let done: Function; const calls: any[] = [];
  const h = host((url, init) => { calls.push(url); return new Promise(resolve => { done = resolve; }); }); h.type('captured');
  const submit = h.submitToModel(); h.type('newer'); done!({plan:{markdown:'captured',revision:1}}); await submit;
  expect(calls).toHaveLength(1); expect(h.state.status).toContain('save again');
});
test('Submit saves first and sends only the acknowledged nonempty plan', async () => {
  const calls: any[] = []; const h = host(async (url, init) => {
    calls.push({url,body:JSON.parse(init.body)}); return url.startsWith('/agent/default/message') ? {ok:true} : {plan:{markdown:'- [ ] saved',revision:1}};
  }); h.type('- [ ] saved'); await h.submitToModel();
  expect(calls).toHaveLength(2); expect(calls[0].body.expected_revision).toBe(0); expect(calls[1].body.content).toContain('- [ ] saved');
});
test('switching chats preserves the dirty baseline and ignores late save responses', async () => {
  let done: Function; const h = host((url, init) => init ? new Promise(resolve => {done=resolve;}) : Promise.resolve({markdown:'B',revision:7}));
  h.type('draft A'); const save = h.savePlan(); h.switch('gi:B'); await Bun.sleep(0);
  done!({plan:{markdown:'draft A',revision:1}}); await save; expect(h.state.markdown).toBe('B'); expect(h.state.revision).toBe(7);
  h.switch('gi:A'); expect(h.state.markdown).toBe('draft A'); expect(h.state.revision).toBe(0); expect(h.state.dirty).toBe(true);
});
test('revision Plan patch rejects duplicate application and unpinned add-on bytes', () => {
  expect(() => patchPlanSidebar(adapted)).toThrow(/source changed/);
  expect(() => patchPlanSidebar(source.replace('state.loading = true;', 'state.loading = false;'))).toThrow(/source changed/);
});
test('Plan HTTP adapter includes native precondition and propagates structured conflict status', async () => {
  const oldFetch = globalThis.fetch; const oldLocation = globalThis.location;
  (globalThis as any).location = {origin:'https://example.test'}; const calls: any[] = [];
  globalThis.fetch = (async (url, init) => { calls.push({url,body:JSON.parse(init!.body as string)}); return new Response(JSON.stringify({error:'stale',code:'plan_revision_conflict'}),{status:409}); }) as any;
  try {
    await expect(giPlanSidebarRequest('/agent/addons/api/plan-sidebar/plan?chat_jid=gi:A',{method:'POST',body:JSON.stringify({markdown:'x',expected_revision:0})})).rejects.toMatchObject({status:409,code:'plan_revision_conflict'});
    expect(calls[0]).toEqual({url:'/api/sessions/A/plan',body:{markdown:'x',expected_revision:0}});
    await expect(giPlanSidebarRequest('/agent/addons/api/plan-sidebar/plan?chat_jid=gi:A',{method:'POST',body:JSON.stringify({action:'reset'})})).rejects.toThrow(/read-only/);
    expect(calls).toHaveLength(1);
  } finally { globalThis.fetch=oldFetch; (globalThis as any).location=oldLocation; }
});
