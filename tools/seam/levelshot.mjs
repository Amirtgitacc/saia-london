import { chromium } from 'playwright';
const OUT = '/Users/at/Projects/site 2/tools/lab/assets/flowcheck';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 });
await page.waitForTimeout(5000); // let the frame sequence decode
const shots = [
  ['entrance', 0.585],
  ['L1-stand', 0.640],
  ['T1-2', 0.692],
  ['L2-reachup', 0.750],
  ['L3-folddog', 0.847],
  ['L4-lowlunge', 0.919],
  ['L5-seated', 0.990],
];
for (const [name, p] of shots) {
  await page.evaluate((p) => window.SAIA._rig.at(p), p);
  await page.waitForTimeout(450); // settle the drawn frame
  await page.evaluate((p) => window.SAIA._rig.at(p), p); // redraw now that frame is warm
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name, p);
}
await browser.close();
