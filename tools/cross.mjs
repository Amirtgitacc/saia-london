import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/cross', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:8000/sample-hybrid.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});
for (const p of [0.27, 0.30, 0.33, 0.37]) {
  await page.evaluate((p) => window.SAIA._rig.at(p), p);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `tools/cross/p${String(p).replace('.','')}.png` });
  console.log('p=' + p);
}
await browser.close();
