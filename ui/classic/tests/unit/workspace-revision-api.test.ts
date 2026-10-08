import { test, expect } from 'bun:test';
import { updateWorkspaceFile, createWorkspaceFile } from '../../src/api';
test('workspace HTTP writes preserve revision type; absent revisions never reach the network', async () => {
  const previous = globalThis.fetch; const calls:any[]=[];
  globalThis.fetch = (async (url, init) => {calls.push({url,method:init.method,body:JSON.parse(init.body)});return Response.json({revision:'next'});}) as any;
  try {
    await updateWorkspaceFile('notes/a.md','text','loaded');await updateWorkspaceFile('notes/a.md','text',0);
    await expect(updateWorkspaceFile('notes/a.md','text',undefined)).rejects.toThrow(/read-only/);
    await createWorkspaceFile('notes','a.copy.md','copy');
    expect(calls).toEqual([
      {url:'/api/workspace/file',method:'PUT',body:{path:'notes/a.md',content:'text',expected_revision:'loaded'}},
      {url:'/api/workspace/file',method:'PUT',body:{path:'notes/a.md',content:'text',expected_revision:0}},
      {url:'/api/workspace/file',method:'POST',body:{path:'notes',name:'a.copy.md',content:'copy'}},
    ]);
  } finally {globalThis.fetch=previous;}
});
test('workspace HTTP errors preserve status/code without automatic retry', async () => {
  const previous=globalThis.fetch;let calls=0;
  globalThis.fetch=(async()=>{calls++;return Response.json({error:'stale',code:'revision_conflict',revision:'remote'},{status:409});}) as any;
  try {
    await expect(updateWorkspaceFile('notes/a.md','draft','loaded')).rejects.toMatchObject({status:409,code:'revision_conflict'});
    expect(calls).toBe(1);
  } finally {globalThis.fetch=previous;}
});
