import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1500, height: 1300 } });
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://localhost:8000/tools/lab/handoff.html', { waitUntil: 'domcontentloaded' });
// wait for the lab to hook the iframe rig
await page.waitForFunction(() => {
  try { const f=document.getElementById('hero'); return f.contentWindow.SAIA && f.contentWindow.SAIA._rig; } catch(e){ return false; }
}, { timeout: 20000 }).catch(()=>{});
await page.waitForTimeout(1500);
// drive the lab's own at() to a crossfade frame and screenshot the stage
for (const [n,p] of [['lab-555',0.555],['lab-566',0.566],['lab-585',0.585]]) {
  await page.evaluate((p) => { const f=document.getElementById('hero'); f.contentWindow.SAIA._rig.at(p); }, p);
  await page.waitForTimeout(400);
  await page.locator('#stage').screenshot({ path:`tools/seam/${n}.png` });
  console.log('shot', n);
}
console.log('rig hooked:', await page.evaluate(()=>{try{return !!document.getElementById('hero').contentWindow.SAIA._rig;}catch(e){return false;}}));
console.log('ERRORS:', errs.length?errs.slice(0,3).join(' | '):'none');
await b.close();
