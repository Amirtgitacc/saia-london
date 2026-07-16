import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig);
await page.waitForFunction(() => { const c = document.getElementById('flowCanvas'); return c && c.width > 1; });
for (let i=0;i<=60;i++) await page.evaluate(pp => window.SAIA._rig.at(pp), 0.576+0.424*(i/60));
await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
await page.evaluate(pp => window.SAIA._rig.at(pp), 0.62);
// screenshot the flowCanvas element ALONE (transparent omitted -> shows only canvas pixels)
await page.locator('#flowCanvas').screenshot({ path: 'tools/seam/canvas-only.png', omitBackground: true });
// what element sits at the white-box location? sample a few points upper-right of the figure
const pts = [[1050,180],[950,150],[1150,200],[1000,250]];
for (const [x,y] of pts) {
  const info = await page.evaluate(([x,y]) => { const el = document.elementFromPoint(x,y); const cs = el?getComputedStyle(el):null; return { id:el?.id, tag:el?.tagName, cls:(el?.className||'').toString().slice(0,40), bg:cs?.backgroundColor, db:el?.getAttribute&&el.getAttribute('data-band') }; }, [x,y]);
  console.log(x,y,'->',JSON.stringify(info));
}
await browser.close();
