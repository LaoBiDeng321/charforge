import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const EDGE = String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`;
const PORT = 9700 + Math.floor(Math.random()*200);
const OUT = String.raw`C:\Users\1\Desktop\角色skill\_溯源\tachibana-sherry-manosaba\raw\web-verify`;
const child = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--no-sandbox',
  '--remote-allow-origins=*', `--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.TEMP}\\ec_${PORT}`,
  '--window-size=1440,900','about:blank'], { stdio: 'ignore' });
const get = async (u) => { try { return await (await fetch(u)).json(); } catch(e) { return null; } };
let wsUrl=null;
for(let i=0;i<80;i++){ const l=await get(`http://127.0.0.1:${PORT}/json/list`); if(l){ const p=l.find(x=>x.type==='page'); if(p?.webSocketDebuggerUrl){wsUrl=p.webSocketDebuggerUrl;break} } await sleep(500); }
if(!wsUrl){ console.log('CDP_UNREADY_2'); child.kill(); process.exit(2); }
const ws=new WebSocket(wsUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let id=0;const pend=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(r=>{const n=++id;pend.set(n,r);ws.send(JSON.stringify({id:n,method:m,params:p}))});
const ev=async(x,a=false)=>{const r=await send('Runtime.evaluate',{expression:x,awaitPromise:a,returnByValue:true});return r.result?.exceptionDetails?'EXC':r.result?.result?.value};
await send('Runtime.enable');await send('Page.enable');
await send('Page.navigate',{url:'http://127.0.0.1:8765/index.html'});
await sleep(7000);
console.log('hero-description 残留:', await ev(`document.querySelectorAll('#hero .hero-description').length`));
console.log('hero-token-note  残留:', await ev(`document.querySelectorAll('#hero .hero-token-note').length`));
console.log('首屏可见文本:', await ev(`JSON.stringify([...document.querySelectorAll('#hero .hero-kicker,#hero .hero-title,#hero .hero-subtitle,#hero .stat-value,#hero .stat-label,#hero .hero-cta button')].map(e=>e.textContent.replace(/\s+/g,' ').trim()))`));
console.log('NaN:', await ev(`(document.body.innerHTML.match(/NaN/g)||[]).length`));
const s=await send('Page.captureScreenshot',{format:'png'});
writeFileSync(`${OUT}\\09-hero-final.png`, Buffer.from(s.result.data,'base64'));
console.log('saved 09-hero-final.png');
ws.close();child.kill();process.exit(0);
