/* SAÏA — jump-cut detector for the flow frame sequence.
   Decodes every frame in-browser, computes mean abs per-channel diff between
   consecutive frames, flags outliers (diff > RATIO× local median AND > FLOOR).
   Outliers = seams / jump cuts. Pure frame-vs-frame (no page text/scrim noise).
   Usage: node tools/seam/flowdiff.mjs [dir] [count] [floor] [ratio] */
import { chromium } from 'playwright';
const DIR   = process.argv[2] || 'assets/flow-frames/';
const COUNT = parseInt(process.argv[3] || '150', 10);
const FLOOR = parseFloat(process.argv[4] || '6');
const RATIO = parseFloat(process.argv[5] || '2.2');
const WIDTH = parseInt(process.argv[6] || '120', 10);   // diff resolution: low = perceptual (blurs paper grain), high = pixel-exact
const BASE  = 'http://localhost:8000/';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
const diffs = await page.evaluate(async ({ DIR, COUNT, BASE, WIDTH }) => {
  const W = WIDTH, H = Math.round(WIDTH * 756 / 1104);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const pad = n => String(n).padStart(3, '0');
  const load = src => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('fail ' + src)); im.src = src;
  });
  let prev = null; const out = [];
  for (let i = 1; i <= COUNT; i++) {
    const im = await load(BASE + DIR + 'f' + pad(i) + '.webp');
    ctx.fillStyle = '#ece8dc'; ctx.fillRect(0, 0, W, H); ctx.drawImage(im, 0, 0, W, H);   // composite over page cream
    const d = ctx.getImageData(0, 0, W, H).data;
    if (prev) {
      let s = 0;
      for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]);
      out.push(s / (d.length / 4 * 3));
    }
    prev = d;
  }
  return out;
}, { DIR, COUNT, BASE, WIDTH });
await browser.close();

const med = arr => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const flags = [];
for (let i = 0; i < diffs.length; i++) {
  const lo = Math.max(0, i - 3), hi = Math.min(diffs.length, i + 4);
  const neigh = []; for (let j = lo; j < hi; j++) if (j !== i) neigh.push(diffs[j]);
  const m = med(neigh);
  const ratio = m > 0 ? diffs[i] / m : diffs[i];
  if (diffs[i] > FLOOR && ratio > RATIO) flags.push({ pair: `f${i + 1}->f${i + 2}`, diff: +diffs[i].toFixed(2), ratio: +ratio.toFixed(2) });
}
const sorted = [...diffs].sort((a, b) => a - b);
console.log(`frames=${COUNT}  pairs=${diffs.length}  median=${med(diffs).toFixed(2)}  p90=${sorted[Math.floor(sorted.length*0.9)].toFixed(2)}  max=${Math.max(...diffs).toFixed(2)}`);
console.log(`floor=${FLOOR}  ratio=${RATIO}  -> OUTLIERS: ${flags.length}`);
flags.sort((a, b) => b.ratio - a.ratio).forEach(f => console.log(`  ${f.pair}  diff=${f.diff}  ratio=${f.ratio}x`));
const top = diffs.map((d, i) => ({ pair: `f${i + 1}->f${i + 2}`, diff: +d.toFixed(2) })).sort((a, b) => b.diff - a.diff).slice(0, 12);
console.log('top 12 diffs:'); top.forEach(t => console.log(`  ${t.pair}  diff=${t.diff}`));
process.exit(flags.length === 0 ? 0 : 1);
