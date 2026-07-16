import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/figposes', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});
const ps = [['1-step',0.58],['2-stand',0.64],['3-reach',0.70],['4-fold',0.76],['5-dog',0.82],['6-seat',0.88],['7-seatreach',0.94]];
for (const [n,p] of ps){
  await page.evaluate((p)=>window.SAIA._rig.at(p), p);
  await page.waitForTimeout(160);
  await page.screenshot({ path:`tools/figposes/${n}.png` });
  console.log(n,p);
}
await browser.close();
