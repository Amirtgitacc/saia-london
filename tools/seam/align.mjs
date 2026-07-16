import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
// ensure flow frame 0 is loaded
await page.waitForFunction(()=>{const a=window.SAIA; return a && a._flowReady !== undefined ? true : (document.images.length>0);},{timeout:5000}).catch(()=>{});
await page.waitForTimeout(600);
const data = await page.evaluate(async () => {
  // SOURCE: mesh mat screen rect at p0.56
  window.SAIA._rig.at(0.56);
  const S = window.SAIA._rig.matRect();
  // draw flow frame 0 and find the navy mat bbox in the flowCanvas, mapped to screen px
  window.SAIA._rig.at(0.576);            // idx 0, draws frame f001 to the canvas
  await new Promise(r=>setTimeout(r,200));
  const c = document.getElementById('flowCanvas');
  const r = c.getBoundingClientRect();
  const cx = c.getContext('2d');
  const g = cx.getImageData(0,0,c.width,c.height).data;
  let minX=c.width,minY=c.height,maxX=0,maxY=0,found=0;
  for (let yy=0; yy<c.height; yy++) for (let xx=0; xx<c.width; xx++){
    const i=(yy*c.width+xx)*4, rr=g[i],gg=g[i+1],bb=g[i+2],aa=g[i+3];
    if (aa>40){ const lum=(rr+gg+bb)/3; if (lum<95 && bb>rr+3){ if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(yy<minY)minY=yy;if(yy>maxY)maxY=yy;found++; } }
  }
  // canvas internal px -> screen px
  const sx = r.width / c.width, sy = r.height / c.height;
  const T = { left:r.left+minX*sx, right:r.left+maxX*sx, top:r.top+minY*sy, bottom:r.top+maxY*sy };
  const rect = o => ({ cx:Math.round((o.left+o.right)/2), cy:Math.round((o.top+o.bottom)/2), w:Math.round(o.right-o.left), h:Math.round(o.bottom-o.top) });
  const Sr=rect(S), Tr=rect(T);
  // transform mapping SOURCE->TARGET with transform-origin 0 0
  const s = Tr.w / Sr.w;
  const tx = Tr.cx - s*Sr.cx, ty = Tr.cy - s*Sr.cy;
  return { canvasRect:{left:Math.round(r.left),top:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}, found, SOURCE:Sr, TARGET:Tr, transform:{ scale:+s.toFixed(4), tx:Math.round(tx), ty:Math.round(ty) } };
});
console.log(JSON.stringify(data,null,2));
await b.close();
