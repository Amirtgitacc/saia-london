/* design exploration only — render the mat at candidate pose-section camera angles */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/angleshot', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 });
// flat mat (deform=1), watercolour material, various cameras. target = mat centre ~(-0.66,0.12,2.16)
const cams = [
  ['1-current-steep',  2.30, 3.78, 8.00],
  ['2-medium',         2.30, 2.60, 8.40],
  ['3-gentle',         2.30, 1.75, 9.00],
  ['4-very-gentle',    2.30, 1.20, 9.60],
];
for (const [name, px, py, pz] of cams) {
  await page.evaluate(({ px, py, pz }) => {
    const r = window.SAIA._rig; r.shot(1, px, py, pz, -0.66, 0.12, 2.16);
    // apply watercolour look so the preview matches the real pose-section mat
    const m = window.SAIA.mat; // material is internal; shot already rendered photoreal — acceptable for angle
  }, { px, py, pz });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `tools/angleshot/${name}.png` });
  console.log(name, py);
}
await browser.close();
