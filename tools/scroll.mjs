/* SAÏA — REAL scroll test: scroll the page to N positions and screenshot.
   Verifies position:sticky now pins the canvas (mat stays on-screen while
   bands change) after the overflow-x:clip fix.
   Usage: node tools/scroll.mjs [url] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const TARGET = process.argv[2] || 'http://localhost:8000/home.html';
mkdirSync('tools/scroll', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(TARGET, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});

const fractions = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
for (let i = 0; i < fractions.length; i++) {
  const f = fractions[i];
  const info = await page.evaluate((f) => {
    const top = document.getElementById('top');
    const max = top.offsetHeight - window.innerHeight;
    window.scrollTo(0, max * f);
    return new Promise((res) => setTimeout(() => {
      const c = document.getElementById('homeCanvas').getBoundingClientRect();
      res({ scrollY: window.scrollY, canvasTop: Math.round(c.top), canvasH: Math.round(c.height) });
    }, 500));
  }, f);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `tools/scroll/${i}-f${f}.png` });
  // canvasTop should stay ~0 if pinned; if it scrolls negative the pin failed
  console.log(`f=${f}  scrollY=${info.scrollY}  canvasTop=${info.canvasTop}  ${info.canvasTop > -50 && info.canvasTop < 80 ? 'PINNED ✓' : 'SCROLLED AWAY ✗'}`);
}
await browser.close();
