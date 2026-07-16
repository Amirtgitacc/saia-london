import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1880, height: 975 } });
const errs=[]; page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:15000}).catch(()=>{});
await page.waitForFunction(()=>{const c=document.getElementById('flowCanvas');return c&&c.width>1;},{timeout:15000}).catch(()=>{});

// IMMEDIATE rapid scrub (no per-frame waiting) — the test the video FAILED.
async function sweep(label, settleMs) {
  const rows = [];
  for (const p of [0.60,0.66,0.72,0.78,0.84,0.90,0.96]) {
    const r = await page.evaluate(async ({p,settleMs}) => {
      window.SAIA._rig.at(p);
      if (settleMs) await new Promise(r=>setTimeout(r,settleMs));
      const c = document.getElementById('flowCanvas');
      const cx = c.getContext('2d');
      // hash a downsample of the canvas to detect frame change + count non-cleared pixels
      const g = cx.getImageData(0,0,c.width,c.height).data;
      let sum=0, drawn=0;
      for (let i=0;i<g.length;i+=4000){ sum=(sum + g[i]*7 + g[i+1]*3 + g[i+2]) % 1000000; if (g[i+3]>0) drawn++; }
      return { hash:sum, drawnSamples:drawn };
    }, {p,settleMs});
    rows.push({ p, ...r });
  }
  console.log(`\n${label}:`); console.table(rows);
  const uniq = new Set(rows.map(r=>r.hash)).size;
  console.log(`  distinct frames rendered: ${uniq} / ${rows.length}`);
  return uniq;
}
const immediate = await sweep('IMMEDIATE scrub (0ms settle — fast scroll)', 0);
const settled   = await sweep('SETTLED scrub (60ms settle)', 60);
console.log('\nERRORS:', errs.length?errs.join(' | '):'none');
console.log(immediate>=5 && settled>=6 ? '\nPASS: frames change as you scrub (not frozen).' : '\nWARN: too few distinct frames — possible frozen/slow load.');
await b.close();
