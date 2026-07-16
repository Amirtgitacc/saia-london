import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT='tools/seam/labout';
mkdirSync(OUT,{recursive:true});
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1880,height:975} });
await page.goto('http://localhost:8000/tools/lab/levels-lab.html',{waitUntil:'domcontentloaded'});
// wait until preload done (loading overlay removed) + canvas sized
await page.waitForFunction(()=>!document.getElementById('loading'),{timeout:30000});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:30000});
const max = await page.evaluate(()=>document.getElementById('track').offsetHeight - innerHeight);
// sample p across holds + transitions
const ps = [0.00, 0.10, 0.20, 0.30, 0.45, 0.55, 0.62, 0.72, 0.85, 0.97];
for (const p of ps){
  await page.evaluate(y=>window.scrollTo(0,y), Math.round(p*max));
  await page.waitForTimeout(180);
  const hud = await page.evaluate(()=>document.getElementById('hud').textContent.replace(/\n/g,' | '));
  const tag = String(Math.round(p*100)).padStart(3,'0');
  await page.screenshot({ path:`${OUT}/p${tag}.png` });
  console.log(`p${tag}  ${hud}`);
}
await b.close();
