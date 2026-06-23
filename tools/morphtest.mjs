/* SAÏA — structural assertions for the mat material morph (R1).
   Confirms uMorph is 0 before the hand-off, 1 after, canvas stays opaque, no console errors. */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 });
const probe = async (p) => page.evaluate((p) => {
  window.SAIA._rig.at(p);
  const c = document.getElementById('homeCanvas');
  return { ...window.SAIA._rig.peek(), canvasOpacity: c.style.opacity };
}, p);
const checks = [];
const a = await probe(0.49); checks.push(['morph@0.49==0', Math.abs(a.morph) < 0.001]);
const b = await probe(0.56); checks.push(['morph@0.56==1', Math.abs(b.morph - 1) < 0.001]);
const c = await probe(0.80); checks.push(['morph@0.80==1', Math.abs(c.morph - 1) < 0.001]);
// canvas is opaque through the morph, faded out during the pose flow (handoff)
const mid = await probe(0.55); checks.push(['canvasOpaque@0.55', mid.canvasOpacity === '1' || mid.canvasOpacity === '']);
checks.push(['canvasFadedOut@0.80', parseFloat(c.canvasOpacity || '1') < 0.02]);
checks.push(['noConsoleErrors', errs.length === 0]);
await browser.close();
let ok = true;
for (const [name, pass] of checks) { console.log(pass ? '✓' : '✗', name); if (!pass) ok = false; }
if (errs.length) console.log('ERRORS:', errs.join(' | '));
process.exit(ok ? 0 : 1);
