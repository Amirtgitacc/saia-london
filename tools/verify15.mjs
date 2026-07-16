import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/verify15', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});
const ps = [
  ['a-0.46-pre', 0.46], ['b-0.53-wash', 0.53], ['c-0.58-walkin', 0.58],
  ['d-0.617-stand', 0.617], ['e-0.674-reach', 0.674], ['f-0.703-heart', 0.703],
  ['g-0.731-hinge', 0.731], ['h-0.760-fold', 0.760], ['i-0.789-dog', 0.789],
  ['j-0.817-lunge', 0.817], ['k-0.846-lowerseat', 0.846], ['l-0.874-seated', 0.874],
  ['m-0.903-twist', 0.903], ['n-0.931-reach', 0.931], ['o-0.960-close', 0.960],
];
for (const [n, p] of ps) {
  await page.evaluate((p) => window.SAIA._rig.at(p), p);
  await page.waitForTimeout(140);
  await page.screenshot({ path: `tools/verify15/${n}.png` });
  console.log(n, p);
}
console.log('CONSOLE ERRORS:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
