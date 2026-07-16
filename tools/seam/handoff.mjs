import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/seam/handoff', { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
await page.waitForTimeout(500);
const ps=[['50',0.50],['53',0.53],['556',0.556],['566',0.566],['572',0.572],['578',0.578],['585',0.585],['60',0.60]];
for(const [n,p] of ps){
  await page.evaluate((p)=>new Promise(res=>{window.SAIA._rig.at(p);setTimeout(res,150);}),p);
  await page.waitForTimeout(80);
  await page.screenshot({path:`tools/seam/handoff/${n}.png`});
  console.log('shot',n,p);
}
console.log('ERRORS:',errs.length?errs.join(' | '):'none');
await b.close();
