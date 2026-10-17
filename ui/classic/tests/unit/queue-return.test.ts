import {test,expect} from 'bun:test';
import {createDraftRepository} from '../../src/gi-drafts';
import {returnQueuedDraft} from '../../src/gi-queue-return';
const parse=content=>({content,fileRefs:[],folderRefs:[],messageRefs:[]});
function fixture(){const saved=new Map();const storage={load:async()=>[...saved.values()],put:async(row,expected)=>{const revision=(saved.get(row.sessionId)?.revision||0)+1;const copy={...row,revision,draft:{...row.draft},pending:[...row.pending],queueReturns:{...row.queueReturns}};saved.set(row.sessionId,copy);return revision;}};return {saved,repo:createDraftRepository(storage)};}
test('queue return persists attachment bytes before removal and retry retains later edits',async()=>{
 const {saved,repo}=fixture();await repo.load();repo.update('s',{text:'earlier'});await repo.flushStable();let removes=0,fetches=0;
 const options={chat:'gi:s',item:{id:'q',text:'queued\n\nAttachments:\n- attachment:media-token (file.txt)'},drafts:repo,parse,isCurrent:()=>true,apply:()=>{},fetcher:async(url)=>{fetches++;expect(url).toBe('/api/sessions/s/media/media-token');return new Response('bytes',{headers:{'Content-Type':'text/plain'}});},remove:async()=>{removes++;expect(saved.get('s').queueReturns.q.state).toBe('prepared');expect(await saved.get('s').draft.media[0].text()).toBe('bytes');if(removes===1)throw Error('lost response');}};
 await expect(returnQueuedDraft(options)).rejects.toThrow('lost response');repo.update('s',{text:'later'});await repo.flushStable();await returnQueuedDraft(options);expect(repo.get('s').text).toBe('later');expect(fetches).toBe(1);expect(saved.get('s').queueReturns.q.state).toBe('removed');
});
test('attachment recovery fences edits and never removes on persistence failure',async()=>{
 const {repo}=fixture();await repo.load();repo.update('s',{text:'before'});await repo.flushStable();let removed=false;
 await expect(returnQueuedDraft({chat:'gi:s',item:{id:'q',text:'queued\n\nAttachments:\n- attachment:1 (x)'},drafts:repo,parse,isCurrent:()=>true,apply:()=>{},fetcher:async()=>{repo.update('s',{text:'newer'});return new Response('x');},remove:async()=>{removed=true;}})).rejects.toThrow('Draft changed');expect(removed).toBe(false);expect(repo.get('s').text).toBe('newer');
});
test('queue removal waits for a successful persistence receipt',async()=>{
 const {repo}=fixture();await repo.load();let removed=false,applied=false;
 const drafts={get:repo.get,hasQueueReturn:()=>false,prepareQueueReturn:()=>({draft:emptyDraft,ready:Promise.reject(Error('quota'))}),queueReturnFailed:()=>{}};
 const emptyDraft={text:'queued',media:[],fileRefs:[],messageRefs:[]};
 await expect(returnQueuedDraft({chat:'gi:s',item:{id:'q',text:'queued'},drafts,parse,isCurrent:()=>true,apply:()=>{applied=true;},remove:async()=>{removed=true;}})).rejects.toThrow('quota');
 expect(applied).toBe(true);expect(removed).toBe(false);
});
