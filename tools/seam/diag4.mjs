import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig);
await page.evaluate(pp => window.SAIA._rig.at(pp), 0.62);
const r = await page.evaluate(() => {
  const hc = document.getElementById('homeCanvas'); const fc = document.getElementById('flowCanvas');
  return { homeCanvasOpacity: hc?.style.opacity, homeCanvasDisplay: hc?getComputedStyle(hc).display:null,
           flowOpacity: fc?.style.opacity };
});
console.log('layers @0.62:', JSON.stringify(r));
// hide flowCanvas, screenshot to reveal what's behind
await page.evaluate(() => { document.getElementById('flowCanvas').style.visibility='hidden'; });
await page.evaluate(pp => window.SAIA._rig.at(pp), 0.62);
await page.screenshot({ path: 'tools/seam/behind.png' });
await browser.close();
