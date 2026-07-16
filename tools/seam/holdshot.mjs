/* SAÏA — screenshot the 5 hold p-centres to confirm pose ↔ band-text sync. */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
const OUT = 'tools/seam/holds';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const HOLDS = [['L1-stand', 0.59], ['L2-reach', 0.69], ['L3-dog', 0.80], ['L4-lunge', 0.90], ['L5-seated', 0.99]];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 });
await page.waitForFunction(() => { const c = document.getElementById('flowCanvas'); return c && c.width > 1; }, { timeout: 15000 });
// warm-up: sweep the whole flow so every frame is requested+decoded (warmFlowAround loads ahead)
for (let i = 0; i <= 60; i++) await page.evaluate(pp => window.SAIA._rig.at(pp), 0.576 + 0.424 * (i / 60));
await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));   // let all frames decode
for (const [name, p] of HOLDS) {
  await page.evaluate(pp => window.SAIA._rig.at(pp), p);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
await browser.close();
console.log('wrote 5 hold shots to', OUT);
