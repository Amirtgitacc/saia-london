import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/seam/out', { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
const errs=[]; page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const v=document.getElementById('flowVideo');return v&&v.readyState>=1&&v.duration>0;},{timeout:15000}).catch(()=>{});
const ps=[['55-mesh',0.55],['565-fadeout',0.565],['575-beat',0.575],['59-videoin',0.59],['62-flow',0.62],['72-flow',0.72],['88-flow',0.88],['96-end',0.96]];
for (const [n,p] of ps){
  await page.evaluate((p)=>new Promise(res=>{const v=document.getElementById('flowVideo');window.SAIA._rig.at(p);if(!v||v.readyState<2)return setTimeout(res,300);v.addEventListener('seeked',()=>setTimeout(res,80),{once:true});setTimeout(res,450);}),p);
  await page.waitForTimeout(140);
  await page.screenshot({ path:`tools/seam/out/${n}.png` });
  console.log(n,p);
}
console.log('ERRORS:', errs.length?errs.join(' | '):'none');
await b.close();
