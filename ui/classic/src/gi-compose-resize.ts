// Host resize lifetime: cancellation restores both layout and page interaction state.
export function startComposeResizeGesture(options: any) {
    const {textarea, handle, startHeight, startY, apply, commit, cancel, jump, current, doc = document, win = window} = options;
    let height=startHeight, moved=false, closed=false;
    const cursor=doc.body.style.cursor, select=doc.body.style.userSelect;
    handle.classList.add('dragging');doc.body.style.cursor='row-resize';doc.body.style.userSelect='none';
    const finish=(accepted:boolean,event?:any)=>{
        if(closed)return;closed=true;
        handle.classList.remove('dragging');doc.body.style.cursor=cursor;doc.body.style.userSelect=select;
        doc.removeEventListener('mousemove',mouse);doc.removeEventListener('mouseup',up);
        doc.removeEventListener('touchmove',touch);doc.removeEventListener('touchend',up);doc.removeEventListener('touchcancel',abort);
        doc.removeEventListener('keydown',key,true);win.removeEventListener('blur',abort);
        if(accepted){commit(height);if(!moved&&textarea.isConnected&&current())jump?.();}
        else {apply(startHeight);cancel();}
    };
    const move=(y:number)=>{if(!current())return finish(false);if(Math.abs(y-startY)>4)moved=true;height=apply(startHeight+startY-y);};
    const mouse=(e:any)=>move(e.clientY),touch=(e:any)=>{if(e.touches?.[0]){e.preventDefault();move(e.touches[0].clientY);}};
    const up=(e:any)=>finish(true,e),abort=()=>finish(false),key=(e:any)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}};
    doc.addEventListener('mousemove',mouse);doc.addEventListener('mouseup',up);doc.addEventListener('touchmove',touch,{passive:false});doc.addEventListener('touchend',up);doc.addEventListener('touchcancel',abort);doc.addEventListener('keydown',key,true);win.addEventListener('blur',abort);
    return abort;
}
