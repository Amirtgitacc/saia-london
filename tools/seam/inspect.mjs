import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 });
await page.waitForFunction(() => { const c = document.getElementById('flowCanvas'); return c && c.width > 1; });
for (let i=0;i<=60;i++) await page.evaluate(pp => window.SAIA._rig.at(pp), 0.576+0.424*(i/60));
await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
// canvas geometry + computed mask
const info = await page.evaluate(() => {
  const c = document.getElementById('flowCanvas'); const b = c.getBoundingClientRect();
  const cs = getComputedStyle(c);
  return { box:{x:b.x,y:b.y,w:b.width,h:b.height}, mask: cs.maskImage || cs.webkitMaskImage, vh: innerHeight };
});
console.log(JSON.stringify(info,null,1));
await page.evaluate(pp => window.SAIA._rig.at(pp), 0.62);   // standing, lots of bg
await page.screenshot({ path: 'tools/seam/inspect-stand.png' });
await browser.close();
