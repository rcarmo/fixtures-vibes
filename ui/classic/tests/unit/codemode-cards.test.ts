import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {parseCodemodeResult,settledCalls,codemodeScript,projectCodemodeCard,staleCodemodeEvent,mergeCodemodeLive,formatDuration,renderCodemodeCard} from '../../src/gi-codemode-cards.ts';
import {projectConversationMessage} from '../../src/gi-conversation.ts';
import {openCodemodeTopic,topicUrl} from '../../src/gi-codemode-topic.ts';
import {patchCodemodeCards} from '../../scripts/patch-codemode-cards.mjs';

// The topic SSE writes the whole envelope, so session identity is on the envelope
// and lifecycle state is its type; a payload phase is not evidence of state.
const envelope=(type:string,payload:any)=>({topic:'runtime.tool',session_id:'s',type,sequence:1,payload});

test('envelope fence uses envelope session and the matching parent call',()=>{
  const ctx={session_id:'s',tool_call_id:'p1',turn_id:'t1'};
  expect(staleCodemodeEvent(envelope('tool_started',{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1',turn_id:'t1'}),ctx)).toBe(false);
  expect(staleCodemodeEvent({...envelope('tool_started',{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1',turn_id:'t1'}),session_id:'other'},ctx)).toBe(true);
  expect(staleCodemodeEvent(envelope('tool_started',{session_id:'s',tool_call_id:'p1/1',parent_tool_call_id:'p2',turn_id:'t1'}),ctx)).toBe(true);
  expect(staleCodemodeEvent(envelope('tool_started',{tool_call_id:'p1/1',parent_tool_call_id:'p1',turn_id:'t2'}),ctx)).toBe(true);
  expect(staleCodemodeEvent(null,ctx)).toBe(true);
});

test('lifecycle state comes from the event type, not a payload phase guess',()=>{
  const rows=mergeCodemodeLive([],envelope('tool_started',{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1',phase:'tool',arguments:{command:'echo x'}}));
  expect(rows[0].status).toBe('running');
  expect(rows[0].durationMs).toBeNull();
  const finished=mergeCodemodeLive(rows,envelope('tool_failed',{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1',phase:'tool',duration_ms:1200,error:'boom'}));
  expect(finished[0].status).toBe('error');
  expect(finished[0].durationMs).toBe(1200);
  // A later start cannot rewrite an immutable terminal occurrence.
  expect(mergeCodemodeLive(finished,envelope('tool_started',{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1'}))[0].status).toBe('error');
  // Unknown event types are not inferred as running or ok.
  expect(mergeCodemodeLive([],envelope('tool_activity_changed',{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1'}))[0].status).toBeNull();
});

test('settled snapshot keeps recorded values and degrades without details',()=>{
  const settled=settledCalls({details:{calls:[{id:'p1/1',name:'shell',args:'echo x',status:'error',durationMs:0,error:'boom'}]}});
  expect(settled[0].status).toBe('error');
  expect(settled[0].durationMs).toBe(0);
  expect(settledCalls({details:{calls:[{id:'',name:'shell'}]}})).toEqual([]);
  expect(settledCalls({}).length).toBe(0);
  // An invalid recorded duration stays unknown, never zero.
  expect(settledCalls({details:{calls:[{id:'p1/1',status:'ok',durationMs:-1}]}})[0].durationMs).toBeNull();
});

test('card projection separates the wrapper header from literal output and never infers status',()=>{
  const parsed=parseCodemodeResult('Script failed\nWall time 2.5 seconds\nOutput:\n<img onerror=alert(1)>');
  expect(parsed.status).toBe('error');
  expect(parsed.wall_seconds).toBe(2.5);
  expect(parsed.output).toBe('<img onerror=alert(1)>');
  const card=projectCodemodeCard({id:'m1',role:'tool_result',session_id:'s',content:'Script completed\nOutput:\nplain',payload:{kind:'tool_result',tool_name:'codemode',tool_call_id:'p1',turn_id:'t1',occurrence_id:'o1',duration_ms:1500,is_error:false,details:{calls:[],fullOutputPath:'vfs://codemode-output/s/file.txt'}}},{script:'return 1'});
  expect(card?.status).toBe('ok');
  expect(card?.duration_ms).toBe(1500);
  expect(card?.full_output_path).toBe('vfs://codemode-output/s/file.txt');
  expect(card?.live).toBe(false);
  // No header and no recorded duration: unknown, not running.
  const unknown=projectCodemodeCard({id:'m2',role:'tool_result',session_id:'s',content:'raw',payload:{kind:'tool_result',tool_name:'codemode',tool_call_id:'p2'}},{script:''});
  expect(unknown?.status).toBeNull();
  expect(unknown?.duration_ms).toBeNull();
  expect(projectCodemodeCard({role:'assistant',content:'x'},{})).toBeNull();
  expect(codemodeScript([{payload:{kind:'tool_calls',tool_calls:[{id:'p1',name:'codemode',arguments:{code:'const x=1'}}]}}],'p1')).toBe('const x=1');
  expect(codemodeScript([{payload:{kind:'tool_calls',tool_calls:[{id:'p9',name:'shell',arguments:{code:'x'}}]}}],'p9')).toBe('');
  expect(formatDuration(0)).toBe('0ms');
  expect(formatDuration(null)).toBe('');
});

test('card renderer keeps model output as text, not markup',()=>{
  const card=projectCodemodeCard({id:'m1',role:'tool_result',session_id:'s',content:'Script failed\nOutput:\n<img onerror=alert(1)>',payload:{kind:'tool_result',tool_name:'codemode',tool_call_id:'p1',is_error:true}},{script:'throw 1'});
  const tag=(s,...v)=>({tag:s,children:v});const vnode=renderCodemodeCard({data:{card}},tag);
  const flat=JSON.stringify(vnode);
  expect(flat).toContain('<img onerror=alert(1)>');
  expect(flat).not.toContain('innerHTML');
  expect(renderCodemodeCard({data:{}})).toBeNull();
  expect(renderCodemodeCard(null)).toBeNull();
});

test('conversation projection shows only the codemode tool_result as a card',()=>{
  const row={id:'m1',role:'tool_result',session_id:'s',content:'Script completed\nOutput:\nplain',payload:{kind:'tool_result',tool_name:'codemode',tool_call_id:'p1'}};
  const post=projectConversationMessage(row,'s');
  expect(post?.data.card?.output).toBe('plain');
  expect(post?.data.kind).toBe('tool_result');
  expect(projectConversationMessage({id:'m2',role:'tool_result',content:'raw',payload:{kind:'tool_result',tool_name:'shell'}},'s')).toBeNull();
});

test('build adapter wires the card renderer through checked anchors only',()=>{
  const source=readFileSync(new URL('../../piclaw/web-3.3.0/web/src/components/post.ts',import.meta.url),'utf8');
  const patched=patchCodemodeCards(source);
  expect(patched).toContain("import { renderCodemodeCard } from '../gi-codemode-cards.js';");
  expect(patched).toContain('${accessory}${renderCodemodeCard(post, html)}');
  // The card path renders text nodes only; vendored markdown may still use innerHTML.
  // A moved anchor must fail the build rather than silently drop the card.
  expect(()=>patchCodemodeCards(source.replace('${accessory}','${accessory ?? null}'))).toThrow('Codemode card anchor changed');
});

test('topic subscription is session-scoped and drops superseded sources',()=>{
  const captured:any={};
  const stubOpen=(url:string)=>({url,addEventListener:(name:string,fn:any)=>{captured[name]=fn;}});
  const got:any[]=[];
  let active=true;
  const source=openCodemodeTopic('s',(e)=>{got.push(e);},{open:stubOpen,isActive:()=>active});
  expect(source.url).toBe('/sse/topics?topic=runtime.tool&session_id=s');
  captured.message({data:JSON.stringify({topic:'runtime.tool',session_id:'s',type:'tool_started',payload:{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1'}})});
  captured.message({data:JSON.stringify({topic:'runtime.tool',session_id:'other',type:'tool_started',payload:{tool:'shell',tool_call_id:'p1/1',parent_tool_call_id:'p1'}})});
  expect(got.length).toBe(1);
  active=false;
  captured.message({data:JSON.stringify({topic:'runtime.tool',session_id:'s',type:'tool_finished',payload:{tool_call_id:'p1/1',parent_tool_call_id:'p1'}})});
  expect(got.length).toBe(1);
});
