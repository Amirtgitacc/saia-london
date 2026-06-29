/* SAÏA — verify the live cel flow: drive _rig.at(p) across the journey, read the
   #flowCanvas pixels directly (avoids the headless screenshot rAF lag), tile to a sheet.
   Usage: node tools/seam/celverify.mjs */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const PS = [0.03, 0.15, 0.27, 0.40, 0.52, 0.65, 0.76, 0.88, 0.97];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, null, { timeout: 30000 });

// force-load + decode EVERY frame into the browser cache first (avoids the cold-load
// nearest-frame fallback that makes the capture look lagged)
await page.evaluate(async () => {
  const n = (window.SAIA_ASSETS && window.SAIA_ASSETS.flowFrameCount) || 303;
  const dir = (window.SAIA_ASSETS && window.SAIA_ASSETS.flowFrameDir) || 'assets/flow-frames/';
  const jobs = [];
  for (let i = 1; i <= n; i++) {
    const img = new Image();
    img.src = dir + 'f' + String(i).padStart(3, '0') + '.webp?v=cel1';
    jobs.push(img.decode().catch(() => {}));
  }
  await Promise.all(jobs);
});
// now sweep so the page's own loader has every frame, then settle
for (let i = 0; i <= 60; i++) await page.evaluate(p => window.SAIA._rig.at(p), i / 60);
await page.waitForTimeout(1500);

const shots = [];
for (const p of PS) {
  await page.evaluate(q => window.SAIA._rig.at(q), p);
  await page.waitForTimeout(120);
  const data = await page.evaluate(() => {
    const c = document.getElementById('flowCanvas');
    return c ? c.toDataURL('image/png') : null;
  });
  shots.push({ p, data });
}
await browser.close();

// write each + a manifest the python step tiles
let ok = 0;
shots.forEach((s, i) => {
  if (!s.data) return;
  ok++;
  writeFileSync(`tools/seam/_cel_p${i}.png`, Buffer.from(s.data.split(',')[1], 'base64'));
});
console.log(`captured ${ok}/${PS.length} canvas shots -> tools/seam/_cel_p*.png  (p=${PS.join(', ')})`);
