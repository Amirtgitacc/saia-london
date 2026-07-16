/* SAÏA — identity-drift strip: sample N evenly-spaced p across the flow,
   crop the upper (head/torso) region of #flowCanvas, tile into one strip.
   Usage: node tools/seam/faces.mjs [n] [from] [to] */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
const N = parseInt(process.argv[2] || '12', 10);
const FROM = parseFloat(process.argv[3] || '0.60');
const TO = parseFloat(process.argv[4] || '0.99');
const OUT = 'tools/seam/faces';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 });
await page.waitForFunction(() => { const c = document.getElementById('flowCanvas'); return c && c.width > 1; }, { timeout: 15000 });
await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
const box = await page.evaluate(() => {
  const c = document.getElementById('flowCanvas'); const b = c.getBoundingClientRect();
  // upper-centre region where the head sits across poses
  return { x: Math.max(0, b.x + b.width * 0.18), y: Math.max(0, b.y), width: b.width * 0.5, height: b.height * 0.55 };
});
const pad = n => String(n).padStart(2, '0');
for (let i = 0; i < N; i++) {
  const p = FROM + (TO - FROM) * (i / (N - 1));
  await page.evaluate(pp => window.SAIA._rig.at(pp), p);
  await page.screenshot({ path: `${OUT}/h${pad(i)}.png`, clip: box });
}
await browser.close();
execSync(`ffmpeg -y -loglevel error -i ${OUT}/h%02d.png -frames:v 1 -vf "scale=240:-1,tile=${N}x1:padding=4:color=white" tools/seam/faces-strip.png`);
console.log(`wrote tools/seam/faces-strip.png  (${N} head crops, p ${FROM}->${TO})`);
