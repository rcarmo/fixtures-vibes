// Durable host policy: snapshot before asynchronous attachment recovery, persist
// the replacement before removal, and never replace a prepared return twice.
export async function returnQueuedDraft({chat,item,drafts,parse,fetcher=fetch,remove,isCurrent,apply}:any){
 const id=chat.slice(3),expected={...drafts.get(id),media:[...drafts.get(id).media],fileRefs:[...drafts.get(id).fileRefs],messageRefs:[...drafts.get(id).messageRefs]};
 try{
  if(!drafts.hasQueueReturn(id,item.id)){
   const parsed=parse(item.content||item.text||'');
   const media=[];
   // Gi persists string media IDs; the upstream parser accepts numeric IDs only.
   const attachments=[...(item.content||item.text||'').matchAll(/^- attachment:([^\s]+)(?:\s*\(([^)]+)\))?$/gm)].map(match=>({id:match[1],label:match[2]}));
   for(const attachment of attachments){
    const response=await fetcher(`/api/sessions/${encodeURIComponent(id)}/media/${encodeURIComponent(attachment.id)}`);
    if(!response.ok)throw Error('Attachment recovery failed');
    const blob=await response.blob();media.push(new File([blob],attachment.label||attachment.name||'attachment',{type:blob.type}));
   }
   const text=parsed.content.replace(/\n\nAttachments:\n[\s\S]*$/,'');
   const prepared=drafts.prepareQueueReturn(id,item.id,{text,media,fileRefs:[...parsed.fileRefs,...parsed.folderRefs],messageRefs:parsed.messageRefs},expected);
   if(isCurrent())apply(prepared.draft);
   await prepared.ready;
  }else {
   const prepared=drafts.prepareQueueReturn(id,item.id,drafts.get(id));
   await prepared.ready;
   if(isCurrent())apply(prepared.draft);
  }
  await remove(item.id,chat);
  await drafts.completeQueueReturn(id,item.id);
  return isCurrent()?drafts.get(id):null;
 }catch(error){
  if(drafts.hasQueueReturn(id,item.id))drafts.queueReturnFailed(id,item.id,error.message);
  throw error;
 }
}
