import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/seam/diag',{recursive:true});
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1880,height:975} });

// 1) sample the flow frame background (corners + center-top) to see if it's white or cream + vignette
await page.goto('http://localhost:8000/assets/flow-frames/f001.jpg',{waitUntil:'load'});
const bg = await page.evaluate(async () => {
  const img = document.querySelector('img'); await img.decode();
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const x=c.getContext('2d'); x.drawImage(img,0,0);
  const hex=(X,Y)=>{const d=x.getImageData(X,Y,1,1).data; return '#'+[d[0],d[1],d[2]].map(n=>n.toString(16).padStart(2,'0')).join('');};
  return { size:[c.width,c.height], topLeft:hex(8,8), topRight:hex(c.width-8,8), topCenter:hex(c.width>>1,8),
           botLeft:hex(8,c.height-8), botRight:hex(c.width-8,c.height-8), midLeft:hex(8,c.height>>1) };
});
console.log('FLOW FRAME f001 background samples:'); console.log(JSON.stringify(bg,null,2));

// 2) isolate the two mats at the crossfade (p0.566): mesh-only vs flow-only
await page.goto('http://localhost:8000/home.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
await page.waitForTimeout(500);
for (const [n,p] of [['xfade-566',0.566],['xfade-570',0.570]]) {
  // full
  await page.evaluate((p)=>new Promise(r=>{window.SAIA._rig.at(p);setTimeout(r,150);}),p);
  await page.screenshot({path:`tools/seam/diag/${n}-both.png`});
  // mesh only (hide flow)
  await page.evaluate(()=>{document.getElementById('flowCanvas').style.visibility='hidden';});
  await page.screenshot({path:`tools/seam/diag/${n}-meshonly.png`});
  // flow only (hide mesh canvas)
  await page.evaluate(()=>{document.getElementById('flowCanvas').style.visibility='visible';document.getElementById('homeCanvas').style.visibility='hidden';});
  await page.screenshot({path:`tools/seam/diag/${n}-flowonly.png`});
  await page.evaluate(()=>{document.getElementById('homeCanvas').style.visibility='visible';});
  console.log('shot',n);
}
await b.close();
