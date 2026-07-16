import { chromium } from 'playwright';
const b = await chromium.launch();
for (const vp of [{width:1880,height:975},{width:1440,height:810},{width:1280,height:800}]) {
  const page = await b.newPage({ viewport: vp });
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
  await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    window.SAIA._rig.at(0.572);                       // crossfade point — alignFor≈1
    // transformed mesh-mat center: untransformed matRect through the live CSS transform
    const m = window.SAIA._rig.matRect();
    const Mcx=(m.left+m.right)/2, Mcy=(m.top+m.bottom)/2;
    const tf = document.getElementById('homeCanvas').style.transform; // translate(x,y) scale(s)
    const nums = (tf.match(/-?\d+\.?\d*/g)||[]).map(Number);
    const tx=nums[0]||0, ty=nums[1]||0, s=nums[2]||1;
    const Tx = Mcx*s+tx, Ty = Mcy*s+ty;               // origin 0 0
    // flow mat target from #flowCanvas rect + FLOWMAT fractions
    const fr = document.getElementById('flowCanvas').getBoundingClientRect();
    const Fx = fr.left + 0.489*fr.width, Fy = fr.top + 0.822*fr.height;
    return { meshXform:[Math.round(Tx),Math.round(Ty)], flowTarget:[Math.round(Fx),Math.round(Fy)], dx:Math.round(Tx-Fx), dy:Math.round(Ty-Fy) };
  });
  console.log(`${vp.width}x${vp.height}: meshMat@xform=${r.meshXform}  flowMat=${r.flowTarget}  delta=(${r.dx},${r.dy})  errors=${errs.length}`);
  await page.close();
}
await b.close();
