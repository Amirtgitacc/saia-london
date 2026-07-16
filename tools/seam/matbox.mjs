import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:8000/tools/seam/raw-frame0.png', { waitUntil: 'load' });
const box = await p.evaluate(async () => {
  const img = document.querySelector('img'); await img.decode();
  const cv = document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight;
  const x = cv.getContext('2d'); x.drawImage(img,0,0);
  const d = x.getImageData(0,0,cv.width,cv.height).data;
  let minX=cv.width,minY=cv.height,maxX=0,maxY=0,found=0;
  for (let yy=Math.floor(cv.height*0.5); yy<cv.height; yy++) for (let xx=0; xx<cv.width; xx++) {
    const i=(yy*cv.width+xx)*4, r=d[i],g=d[i+1],bl=d[i+2];
    const lum=(r+g+bl)/3;
    if (lum < 95 && bl > r+3) { // navy mat: dark + bluish (excludes warm hair/leggings)
      if (xx<minX)minX=xx; if (xx>maxX)maxX=xx; if (yy<minY)minY=yy; if (yy>maxY)maxY=yy; found++;
    }
  }
  return { matPx:{left:minX,top:minY,right:maxX,bottom:maxY,w:maxX-minX,h:maxY-minY,cx:Math.round((minX+maxX)/2),cy:Math.round((minY+maxY)/2),found} };
});
console.log(JSON.stringify(box,null,2));
await b.close();
