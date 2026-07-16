/* Renders the 3D mat ALONE and the watercolour mat ALONE at the morph point so the camera
   can be tuned to land the 3D mat on the hero-mat PNG's rect. Usage: node tools/morphcheck.mjs [p] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/morph', { recursive: true });
const P = Number(process.argv[2] || 0.52);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});

// 3D mat alone (hide the PNG mat + figures)
await page.evaluate((P) => {
  window.SAIA._rig.at(P);
  document.getElementById('homeCanvas').style.opacity = '1';
  document.getElementById('matStage').style.opacity = '0';
  document.querySelectorAll('#figureLayer .saia-fig').forEach(e => e.style.opacity = '0');
}, P);
await page.waitForTimeout(140);
await page.screenshot({ path: 'tools/morph/3d.png' });

// watercolour mat alone (hide canvas, no bloom)
await page.evaluate(() => {
  document.getElementById('homeCanvas').style.opacity = '0';
  const m = document.getElementById('matStage'); m.style.opacity = '1'; m.style.filter = 'none';
}, P);
await page.waitForTimeout(140);
await page.screenshot({ path: 'tools/morph/wc.png' });

console.log('morphcheck @ p', P, '→ tools/morph/3d.png + wc.png');
await browser.close();
