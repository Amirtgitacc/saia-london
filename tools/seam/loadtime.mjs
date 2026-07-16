import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
const t0 = await page.evaluate(()=>performance.now());
const result = await page.evaluate(async () => {
  const dir='assets/flow-frames/', N=150;
  const pad=n=>String(n).padStart(3,'0');
  // mirror the app: measure how long to load+decode ALL 150 frames from a cold-ish cache
  const start = performance.now();
  let firstAll=null;
  // poll the app's own loading by forcing-load all and awaiting decode
  const imgs = [];
  for (let i=1;i<=N;i++){ const im=new Image(); im.src=dir+'f'+pad(i)+'.jpg'; imgs.push(im); }
  await Promise.all(imgs.map(im=> im.decode().catch(()=>{})));
  return { ms: Math.round(performance.now()-start) };
});
console.log('Time to load+decode all 150 frames (warm localhost):', result.ms, 'ms');
// total bytes
await b.close();
