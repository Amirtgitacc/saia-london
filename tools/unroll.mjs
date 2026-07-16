/* SAÏA — inspect the unroll mechanics up close.
   Uses _rig.shot(d, px,py,pz, tx,ty,tz) to render specific deform states
   from chosen camera poses so we can see (1) where the mat peels off the
   roll, (2) the far-edge lip when flat, (3) corner sharpness.
   Usage: node tools/unroll.mjs [url] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const TARGET = process.argv[2] || 'http://localhost:8000/home.html';
mkdirSync('tools/unroll', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(TARGET, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});

// [name, d, cam pose] — poses chosen to study the roll & edges
const SHOTS = [
  // close on the coil mid-unroll: does the sheet peel off the BOTTOM?
  ['a-roll-15', 0.15, [2.2, 1.3, 3.0, -0.7, 0.15, 0.2]],
  ['b-roll-35', 0.35, [2.2, 1.3, 3.0, -0.7, 0.15, 0.2]],
  ['c-roll-60', 0.60, [2.2, 1.3, 3.0, -0.7, 0.15, 0.2]],
  // flat mat, low grazing angle to reveal any far-edge lip
  ['d-flat-graze', 1.0, [3.4, 0.9, 4.0, -0.6, 0.0, 1.8]],
  // flat mat, top-down on a corner to judge sharpness
  ['e-flat-corner', 1.0, [1.2, 3.6, 2.0, -0.3, 0.0, 0.6]],
];

for (const [name, d, c] of SHOTS) {
  await page.evaluate(([d, c]) => window.SAIA._rig.shot(d, c[0], c[1], c[2], c[3], c[4], c[5]), [d, c]);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `tools/unroll/${name}.png` });
  console.log('shot', name, 'd=' + d);
}
await browser.close();
