import { chromium } from 'playwright';
const b = await chromium.launch();
// mobile + reduced motion
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true });
const errors = [];
pg.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await pg.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);
const state = await pg.evaluate(() => ({
  isStatic: document.getElementById('homeRoot').classList.contains('is-static'),
  canvasDisplay: getComputedStyle(document.getElementById('homeCanvas')).display,
  pngDisplay: getComputedStyle(document.getElementById('homeMat')).display,
  hasRig: !!(window.SAIA && window.SAIA._rig),
}));
await pg.screenshot({ path: 'tools/shots/fallback-mobile.png', fullPage: true });
console.log('fallback state', JSON.stringify(state), 'errors', errors.length ? errors : 'none');
await b.close();
