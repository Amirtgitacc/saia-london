import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1880,height:975} });
await page.goto('http://localhost:8000/home.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});
await page.waitForTimeout(500);

const r = await page.evaluate(() => {
  const darkBox = (canvas, toScreen) => {
    const cx = canvas.getContext('2d') || canvas.getContext('webgl');
    let g, W=canvas.width, H=canvas.height;
    const c2 = document.createElement('canvas'); c2.width=W; c2.height=H;
    const x2=c2.getContext('2d'); x2.drawImage(canvas,0,0);
    g = x2.getImageData(0,0,W,H).data;
    let minX=W,minY=H,maxX=0,maxY=0,n=0;
    for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){const i=(yy*W+xx)*4,rr=g[i],gg=g[i+1],bb=g[i+2],aa=g[i+3];
      if(aa>60){const lum=(rr+gg+bb)/3; if(lum<95){if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(yy<minY)minY=yy;if(yy>maxY)maxY=yy;n++;}}}
    if(!n) return null;
    return toScreen(minX,minY,maxX,maxY,canvas);
  };
  window.SAIA._rig.at(0.572);
  const home = document.getElementById('homeCanvas');
  const flow = document.getElementById('flowCanvas');
  // homeCanvas: full-viewport element; CSS transform applies. Read its drawingbuffer, map via clientRect+transform.
  const hr = home.getBoundingClientRect();   // getBoundingClientRect already includes CSS transform
  const fr = flow.getBoundingClientRect();
  const meshBox = darkBox(home, (a,bb,c,d,cv)=>{const sx=hr.width/cv.width, sy=hr.height/cv.height; return {cx:Math.round(hr.left+(a+c)/2*sx),cy:Math.round(hr.top+(bb+d)/2*sy),w:Math.round((c-a)*sx),h:Math.round((d-bb)*sy)};});
  const flowBox = darkBox(flow, (a,bb,c,d,cv)=>{const sx=fr.width/cv.width, sy=fr.height/cv.height; return {cx:Math.round(fr.left+(a+c)/2*sx),cy:Math.round(fr.top+(bb+d)/2*sy),w:Math.round((c-a)*sx),h:Math.round((d-bb)*sy)};});
  return { meshMat:meshBox, flowMat:flowBox, dy: (meshBox&&flowBox)? meshBox.cy-flowBox.cy : null, dx:(meshBox&&flowBox)?meshBox.cx-flowBox.cx:null };
});
console.log('At p0.572 (crossfade) — ACTUAL rendered dark-mat centres:');
console.log(JSON.stringify(r,null,2));
await b.close();
