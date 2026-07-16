import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig);
await page.waitForFunction(() => { const c = document.getElementById('flowCanvas'); return c && c.width > 1; });
for (let i=0;i<=60;i++) await page.evaluate(pp => window.SAIA._rig.at(pp), 0.576+0.424*(i/60));
await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
await page.evaluate(pp => window.SAIA._rig.at(pp), 0.62);
await page.screenshot({ path: 'tools/seam/with-bands.png' });
// hide bands' background only
await page.evaluate(() => { document.querySelectorAll('[data-band]').forEach(e => e.style.background='none'); });
await page.evaluate(pp => window.SAIA._rig.at(pp), 0.62);
await page.screenshot({ path: 'tools/seam/no-band-bg.png' });
// also report --scrim
const scrim = await page.evaluate(() => getComputedStyle(document.getElementById('homeRoot')).getPropertyValue('--scrim'));
console.log('--scrim @0.62:', scrim);
await browser.close();
