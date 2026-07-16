/* SAÏA — dense scrub sweep of the live flow → mp4, to eyeball motion smoothness.
   Sweeps p across the flow range via window.SAIA._rig.at(p), screenshots the
   #flowCanvas bounding box each step, then ffmpegs to an mp4.
   Usage: node tools/seam/flowpreview.mjs [steps] [from] [to] */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
const STEPS = parseInt(process.argv[2] || '200', 10);
const FROM = parseFloat(process.argv[3] || '0.556');
const TO = parseFloat(process.argv[4] || '1.0');
const OUT = 'tools/seam/out';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 });
await page.waitForFunction(() => { const c = document.getElementById('flowCanvas'); return c && c.width > 1; }, { timeout: 15000 });
// preload all flow frames so the sweep never falls back to a nearest frame
await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
const box = await page.evaluate(() => {
  const c = document.getElementById('flowCanvas'); const b = c.getBoundingClientRect();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, innerWidth - b.x), height: Math.min(b.height, innerHeight - b.y) };
});
const pad = n => String(n).padStart(4, '0');
for (let i = 0; i < STEPS; i++) {
  const p = FROM + (TO - FROM) * (i / (STEPS - 1));
  await page.evaluate(pp => window.SAIA._rig.at(pp), p);
  await page.screenshot({ path: `${OUT}/s${pad(i)}.png`, clip: box });
}
await browser.close();
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${OUT}/s%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 tools/seam/flow-preview.mp4`);
console.log(`wrote tools/seam/flow-preview.mp4  (${STEPS} frames, p ${FROM}->${TO})`);
