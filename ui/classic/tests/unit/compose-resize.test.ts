import {test,expect} from 'bun:test';
import {startComposeResizeGesture} from '../../src/gi-compose-resize.ts';
function fixture(){
 const doc:any=new EventTarget(),win:any=new EventTarget();doc.body={style:{cursor:'old',userSelect:'text'}};
 const classes=new Set<string>(),handle={classList:{add:(s:string)=>classes.add(s),remove:(s:string)=>classes.delete(s)}};
 let height=80,commits:number[]=[],cancelled=0,current=true,jumps=0;
 const close=startComposeResizeGesture({doc,win,handle,textarea:{isConnected:true},startHeight:80,startY:100,apply:(v:number)=>height=v,commit:(v:number)=>commits.push(v),cancel:()=>cancelled++,current:()=>current,jump:()=>jumps++});
 const event=(target:any,type:string,props:any={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e)};
 return {doc,win,event,close,classes,stale:()=>current=false,state:()=>({height,commits,cancelled,jumps})};
}
for(const mode of ['escape','touchcancel','blur','stale'])test(`resize ${mode} restores layout and interaction state without commit`,()=>{
 const f=fixture();f.event(f.doc,'mousemove',{clientY:60});expect(f.state().height).toBe(120);
 if(mode==='escape')f.event(f.doc,'keydown',{key:'Escape'});else if(mode==='blur')f.event(f.win,'blur');else if(mode==='stale'){f.stale();f.event(f.doc,'mousemove',{clientY:50})}else f.event(f.doc,'touchcancel');
 expect(f.state()).toEqual({height:80,commits:[],cancelled:1,jumps:0});expect(f.doc.body.style).toEqual({cursor:'old',userSelect:'text'});expect(f.classes.size).toBe(0);
 f.event(f.doc,'mousemove',{clientY:20});f.close();expect(f.state().cancelled).toBe(1);
});
test('resize completion commits once and removes listeners',()=>{const f=fixture();f.event(f.doc,'mousemove',{clientY:60});f.event(f.doc,'mouseup');f.event(f.doc,'mouseup');expect(f.state().commits).toEqual([120]);expect(f.state().cancelled).toBe(0)});
