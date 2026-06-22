/* SAÏA — capture the Home journey at each band's scroll-progress p.
   Renders via window.SAIA._rig.at(p) with the page at the top, because
   position:sticky does not composite under programmatic scroll in this
   headless environment. at(p) uses the real camAt/deformFor/bands, so the
   captured frame is exactly what a user sees at progress p.
   Usage: node tools/shots.mjs [url] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const TARGET = process.argv[2] || 'http://localhost:8000/home.html';
mkdirSync('tools/shots', { recursive: true });

// [name, p] — p at the visual centre of each band
const BANDS = [
  ['1-hero', 0.05], ['2-mat', 0.19], ['3-how', 0.36], ['4-gather', 0.51],
  ['5-club', 0.65], ['6-pilates', 0.79], ['7-join', 0.95],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(TARGET, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 })
  .catch(() => console.log('(no _rig — fallback/static mode?)'));

for (const [name, p] of BANDS) {
  await page.evaluate((p) => window.SAIA._rig.at(p), p);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `tools/shots/${name}.png` });
  console.log('shot', name, 'p=' + p);
}

if (errors.length) { console.log('\nCONSOLE ERRORS:'); errors.forEach((e) => console.log(' -', e)); }
else console.log('\nno console errors');
await browser.close();
