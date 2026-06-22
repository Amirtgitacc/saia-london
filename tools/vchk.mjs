import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(()=>{});
const ps=[['peak-dog',0.789],['mid-fold-dog',0.775],['mid-dog-lunge',0.803],['close',0.960]];
for (const [n,p] of ps){ await page.evaluate(p=>window.SAIA._rig.at(p),p); await page.waitForTimeout(140); await page.screenshot({path:`tools/verify15/z-${n}.png`}); }
await browser.close(); console.log('done');
