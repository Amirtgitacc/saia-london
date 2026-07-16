import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(()=>{const v=document.getElementById('flowVideo');return v&&v.readyState>=1;},{timeout:15000}).catch(()=>{});
// EARLY scrub (like a user scrolling immediately) — no waiting for full download
const early = await page.evaluate(async () => {
  const v = document.getElementById('flowVideo');
  const out = [];
  const bend = () => v.buffered.length ? +v.buffered.end(v.buffered.length-1).toFixed(1) : 0;
  for (const t of [2, 12, 25, 40, 55, 65]) {
    v.currentTime = t;
    await new Promise(r => { let done=false; v.addEventListener('seeked',()=>{done=true;r();},{once:true}); setTimeout(()=>{if(!done)r();}, 600); });
    out.push({ want:t, got:+v.currentTime.toFixed(2), buffered_to:bend(), readyState:v.readyState });
  }
  return out;
});
console.log('EARLY scrub (immediately, file still downloading):');
console.table(early);
// Now wait for full download, then scrub again
await page.evaluate(() => new Promise(res => {
  const v = document.getElementById('flowVideo');
  const check = () => { if (v.buffered.length && v.buffered.end(v.buffered.length-1) >= v.duration-0.5) res(); else setTimeout(check,300); };
  check();
}));
const late = await page.evaluate(async () => {
  const v = document.getElementById('flowVideo'); const out=[];
  for (const t of [2,12,25,40,55,65]) {
    const t0=Date.now(); v.currentTime=t;
    await new Promise(r => { let done=false; v.addEventListener('seeked',()=>{done=true;r();},{once:true}); setTimeout(()=>{if(!done)r();},600); });
    out.push({ want:t, got:+v.currentTime.toFixed(2), seek_ms:Date.now()-t0 });
  }
  return out;
});
console.log('LATE scrub (after full 29MB downloaded):');
console.table(late);
await b.close();
