import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 }).catch(()=>{});
await page.waitForFunction(() => { const v=document.getElementById('flowVideo'); return v && v.readyState>=1 && v.duration>0; }, { timeout: 15000 }).catch(()=>{});
const data = await page.evaluate(() => {
  window.SAIA._rig.at(0.56);
  const mesh = window.SAIA._rig.matRect();           // mesh mat bbox in canvas px
  const v = document.getElementById('flowVideo');
  const r = v.getBoundingClientRect();
  // object-fit:contain content box within the element
  const nW=v.videoWidth, nH=v.videoHeight, eW=r.width, eH=r.height;
  const scale = Math.min(eW/nW, eH/nH);
  const cW=nW*scale, cH=nH*scale;
  const opx=0.72, opy=0.60;                            // object-position 72% 60%
  const cx=(eW-cW)*opx, cy=(eH-cH)*opy;                // content offset within element
  return { viewport:{w:eW,h:eH}, mesh, video:{nW,nH,scale:+scale.toFixed(3), contentRect:{left:+cx.toFixed(0),top:+cy.toFixed(0),w:+cW.toFixed(0),h:+cH.toFixed(0)}} };
});
console.log(JSON.stringify(data, null, 2));
await b.close();
