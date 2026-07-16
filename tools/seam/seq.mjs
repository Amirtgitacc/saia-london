import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/seam/seq',{recursive:true});
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1880,height:975} });
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://localhost:8000/home.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
await page.waitForTimeout(500);
const ps=[['a-0.55-mat',0.55],['b-0.565-matout',0.565],['c-0.573-beat',0.573],['d-0.582-in',0.582],['e-0.60-flow',0.60],['f-0.72-flow',0.72]];
for(const [n,p] of ps){
  await page.evaluate((p)=>new Promise(r=>{window.SAIA._rig.at(p);setTimeout(r,160);}),p);
  await page.waitForTimeout(80);
  await page.screenshot({path:`tools/seam/seq/${n}.png`});
}
console.log('ERRORS:',errs.length?errs.join(' | '):'none');
await b.close();
