/* design exploration — render the watercolour mat (clean, no text) at candidate gentle pose angles */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 });
// hide page chrome so only the watercolour mat on cream remains
await page.evaluate(() => {
  for (const id of ['stage','homeBar','homeHint']) { const e = document.getElementById(id); if (e) e.style.display='none'; }
  document.querySelector('header')?.style && (document.querySelector('header').style.opacity='0');
});
// target = mat centre. candidate cameras (px fixed, py = elevation, pz = distance)
const cams = [
  ['A-current',   2.30, 3.78, 8.00],
  ['B-medium',    2.30, 2.85, 8.60],
  ['C-gentle',    2.30, 2.15, 9.20],
  ['D-gentler',   2.30, 1.70, 9.70],
];
for (const [name, px, py, pz] of cams) {
  await page.evaluate(({px,py,pz}) => window.SAIA._rig.shotMorph(1, 1, px, py, pz, -0.66, 0.12, 2.16), {px,py,pz});
  await page.waitForTimeout(140);
  await page.screenshot({ path: `tools/lab/assets/mat-${name}.png` });
  console.log('rendered', name);
}
await browser.close();
