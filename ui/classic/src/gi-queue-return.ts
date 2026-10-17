import {buildReturnedQueuedDraft} from './components/compose-box.js';

// Durable host policy: snapshot before asynchronous attachment recovery, persist
// the replacement before removal, and never replace a prepared return twice.
export async function returnQueuedDraft({chat,item,drafts,fetcher=fetch,remove,isCurrent,apply}:any){
 const id=chat.slice(3),expected=drafts.snapshot(id).draft;
 try{
  if(!drafts.hasQueueReturn(id,item.id)){
   const parsed=buildReturnedQueuedDraft(item.content||'');
   const media=[];
   // Gi persists string media IDs; the upstream parser accepts numeric IDs only.
   const attachments=[...(item.content||'').matchAll(/^- attachment:([^\s]+)(?:\s*\(([^)]+)\))?$/gm)].map(match=>({id:match[1],label:match[2]}));
   for(const attachment of attachments){
    const response=await fetcher(`/api/media/${encodeURIComponent(attachment.id)}/raw`);
    if(!response.ok)throw Error('Attachment recovery failed');
    const blob=await response.blob();media.push(new File([blob],attachment.label||attachment.name||'attachment',{type:blob.type}));
   }
   const text=parsed.content.replace(/\n\nAttachments:\n[\s\S]*$/,'');
   await drafts.prepareQueueReturn(id,item.id,{text,media,fileRefs:[...parsed.fileRefs,...parsed.folderRefs],messageRefs:parsed.messageRefs},expected);
  }else await drafts.prepareQueueReturn(id,item.id,drafts.snapshot(id).draft);
  if(isCurrent())apply(drafts.snapshot(id).draft);
  await remove(item.id,chat);
  await drafts.completeQueueReturn(id,item.id);
  return isCurrent()?drafts.snapshot(id).draft:null;
 }catch(error){
  if(drafts.hasQueueReturn(id,item.id))drafts.queueReturnFailed(id,item.id,error.message);
  throw error;
 }
}
