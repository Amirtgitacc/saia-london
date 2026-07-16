import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/shots', { recursive: true });
const d = parseFloat(process.argv[2] ?? '1');
const tag = process.argv[3] ?? 'cam';
// poses: [px,py,pz, tx,ty,tz]
const POSES = JSON.parse(process.argv[4]);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 });
for (let i = 0; i < POSES.length; i++) {
  const c = POSES[i];
  await p.evaluate((c) => window.SAIA._rig.shot.apply(null, c), [d, ...c]);
  await p.waitForTimeout(120);
  const name = `${tag}-${String.fromCharCode(97+i)}`;
  await p.screenshot({ path: `tools/shots/${name}.png` });
  console.log(name, JSON.stringify(c));
}
await b.close();
