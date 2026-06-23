/* SAÏA — watercolour mat handoff verification. Renders the handoff window + the
   pose flow so we can confirm one mat under Cristina's feet. Usage: node tools/matshot.mjs */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/matshot', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
// not 'networkidle': flow.mp4 (preload=auto) keeps the network busy; wait on the rig + video metadata instead
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 15000 }).catch(() => {});
// the flow video must have its duration before _rig.at() can map scroll→currentTime
await page.waitForFunction(() => { const v = document.getElementById('flowVideo'); return v && v.readyState >= 1 && v.duration > 0; }, { timeout: 15000 }).catch(() => {});
// pose centres match FIG_FROM..FIG_TO (0.580→0.960, 15 evenly-spaced poses) so frames land ON poses
const ps = [
  ['a-0.48-showcase', 0.48], ['b-0.52-handoff', 0.52], ['c-0.56-walkin', 0.56],
  ['d-0.634-stand', 0.634], ['e-0.716-heart', 0.716], ['f-0.743-hinge', 0.743],
  ['g-0.797-dog', 0.797], ['h-0.824-lunge', 0.824], ['i-0.878-seated', 0.878],
  ['j-0.960-close', 0.960],
];
for (const [n, p] of ps) {
  // _rig.at(p) sets flowVideo.currentTime via scrubFlow; wait for the 'seeked' event so the
  // decoded frame is on-screen before the screenshot (headless decode lags the seek)
  await page.evaluate((p) => new Promise((res) => {
    const v = document.getElementById('flowVideo');
    window.SAIA._rig.at(p);
    if (!v || v.readyState < 2 || v.seeking === false) return setTimeout(res, 250);
    v.addEventListener('seeked', () => setTimeout(res, 60), { once: true });
    setTimeout(res, 400);  // safety net if 'seeked' never fires
  }), p);
  await page.waitForTimeout(160);
  await page.screenshot({ path: `tools/matshot/${n}.png` });
  console.log(n, p);
}
console.log('CONSOLE ERRORS:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
