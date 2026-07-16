import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1880,height:975} });
await page.goto('http://localhost:8000/home.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  // settle camera & flatten via the rig, then read the mesh mat rect (SOURCE basis)
  window.SAIA._rig.at(0.62);
  const S = window.SAIA._rig.matRect();
  const Scx=(S.left+S.right)/2, Scy=(S.top+S.bottom)/2, Sw=S.right-S.left, Sh=S.bottom-S.top;
  // flow target from the live flowCanvas rect + the FLOWMAT fractions used in code
  const fr = document.getElementById('flowCanvas').getBoundingClientRect();
  const FX=0.489, FY=0.822, FW=0.401;
  const Tcx=fr.left+FX*fr.width, Tcy=fr.top+FY*fr.height, Tw=FW*fr.width;
  // what transform is actually applied at the crossfade?
  window.SAIA._rig.at(0.572);
  const applied = document.getElementById('homeCanvas').style.transform;
  return {
    SOURCE_meshRect:{cx:Math.round(Scx),cy:Math.round(Scy),w:Math.round(Sw),h:Math.round(Sh), raw:S},
    flowCanvasRect:{left:Math.round(fr.left),top:Math.round(fr.top),w:Math.round(fr.width),h:Math.round(fr.height)},
    TARGET:{cx:Math.round(Tcx),cy:Math.round(Tcy),w:Math.round(Tw)},
    appliedTransform: applied
  };
});
console.log(JSON.stringify(r,null,2));
await b.close();
