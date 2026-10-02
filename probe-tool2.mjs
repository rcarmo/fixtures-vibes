import { chromium } from '@playwright/test';
const B='http://192.168.1.236:8090';
const r=await fetch(B+'/agent/root-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agent_name:'fxtool'+Date.now()%100000})});
const J=(await r.json()).branch.chat_jid;
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto(B+'/?chat_jid='+encodeURIComponent(J));
const i=p.locator('.compose-box textarea');
const n='x'+Date.now()%10000;
await i.fill(`[tool:bash ${JSON.stringify({command:`echo out-start-${n}; sleep 4; echo out-end-${n}`})}][after-tool:Tool finished ${n}] run tool ${n}`); await i.press('Enter');
for (let k=0;k<12;k++){ await p.waitForTimeout(500); const t=await p.locator('.agent-status-panel').first().innerText().catch(()=>'-'); console.log(k, JSON.stringify(t.slice(0,80)), await p.getByText(/^\s*Output\b/).count()); }
await b.close();
