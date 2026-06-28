/* SAÏA — reassemble assets/flow-frames/ from the 4 seam-free clips.
   Each MOVE zone = one continuous clip (no internal seam). Consecutive clips
   are chained (clip k start = clip k-1 last frame) so boundaries are shared.
   Every frame's BACKGROUND is normalised per-frame to the page cream #ece8dc
   (kills the visible frame border) before scaling to 1104x756. We evenly
   subsample each clip, concatenate, and cross-fade clip boundaries.
   Prints the FLOW_STOPS anchor indices to paste into js/home-journey.js.
   Usage: node tools/seam/assemble.mjs */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'node:fs';

const CLIPS = [
  { file: 'tools/seam/clips/clip1.mp4', samples: 70, label: 'stand->reach (kling3.0, Cristina-soul)' },
  { file: 'tools/seam/clips/clip2.mp4', samples: 80, label: 'reach->dog (kling3.0, Cristina-soul)' },
  { file: 'tools/seam/clips/clip3.mp4', samples: 72, label: 'dog->lunge (kling3.0, Cristina-soul)' },
  { file: 'tools/seam/clips/clip4.mp4', samples: 60, label: 'lunge->seated (kling3.0, Cristina-soul)' },
];
const W = 1544, H = 1058, BG = '0xece8dc', Q = 4;
const TARGET = [236, 232, 220];   // #ece8dc — page cream; every frame's bg is normalised to this
const OUT = 'assets/flow-frames';
const TMP = 'tools/seam/asm';
const pad3 = n => String(n).padStart(3, '0');
const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`;
const XFADE = 8;           // cross-fade frames at each clip boundary (same pose, different render → smooth)

// per-frame bg-normalise: measure the native frame's top-left corner (always bg — figure is
// centred), scale each channel so that bg → TARGET, then colour-correct + fit + pad to #ece8dc.
function correct(src, dst) {
  const hex = execSync(`ffmpeg -v error -i ${src} -vf "crop=160:120:24:24,scale=1:1" -f rawvideo -pix_fmt rgb24 - | xxd -p`).toString().trim();
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const cl = x => Math.max(0.80, Math.min(1.15, x));
  const fr = cl(TARGET[0] / r), fg = cl(TARGET[1] / g), fb = cl(TARGET[2] / b);
  const cvf = `colorchannelmixer=rr=${fr.toFixed(4)}:gg=${fg.toFixed(4)}:bb=${fb.toFixed(4)},${vf}`;
  execSync(`ffmpeg -y -loglevel error -i ${src} -vf "${cvf}" -q:v ${Q} ${dst}`);
}

rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
if (existsSync(OUT) && !existsSync('tools/seam/flow-frames-backup')) {
  execSync(`cp -r ${OUT} tools/seam/flow-frames-backup`);
  console.log('backed up current frames -> tools/seam/flow-frames-backup');
}
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });

let outIdx = 0;            // 0-based count of frames written
let prevLast = null;       // path of the last frame written (for boundary cross-fade)
const anchorIdx = [];      // frame index of each clip's LAST frame (= the holds)
for (let c = 0; c < CLIPS.length; c++) {
  const { file, samples, label } = CLIPS[c];
  const dir = `${TMP}/c${c}`; mkdirSync(dir, { recursive: true });
  execSync(`ffmpeg -y -loglevel error -i ${file} -q:v 2 ${dir}/r%04d.jpg`);   // raw native frames
  const all = readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
  const N = all.length;
  const pick = [];
  for (let i = 0; i < samples; i++) pick.push(Math.round(i * (N - 1) / (samples - 1)));
  const uniq = [...new Set(pick)];
  const start = c === 0 ? 0 : 1;   // clips after the first drop their first frame (dup of prev last)
  // corrected first-kept frame — used both as the cross-fade endpoint and the first written frame
  const firstC = `${dir}/_first.jpg`;
  correct(`${dir}/${all[uniq[start]]}`, firstC);
  if (prevLast) {
    for (let k = 1; k <= XFADE; k++) {
      const w = k / (XFADE + 1); outIdx++;
      execSync(`ffmpeg -y -loglevel error -i ${prevLast} -i ${firstC} -filter_complex "blend=all_mode=normal:all_opacity=${w}" -q:v ${Q} ${OUT}/f${pad3(outIdx)}.jpg`);
    }
  }
  outIdx++; copyFileSync(firstC, `${OUT}/f${pad3(outIdx)}.jpg`);   // the first-kept (corrected) frame
  for (let i = start + 1; i < uniq.length; i++) {
    outIdx++; correct(`${dir}/${all[uniq[i]]}`, `${OUT}/f${pad3(outIdx)}.jpg`);
  }
  prevLast = `${OUT}/f${pad3(outIdx)}.jpg`;
  anchorIdx.push(outIdx - 1);
  console.log(`clip${c + 1} ${label}: ${N} src -> ${uniq.length - start + 1} frames (+${c > 0 ? XFADE : 0} xfade), last@${outIdx - 1}`);
}

const total = outIdx;
const [reachIdx, dogIdx, lungeIdx, seatedIdx] = anchorIdx;
const sz = execSync(`du -sh ${OUT}`).toString().trim().split('\t')[0];
console.log(`\nTOTAL FRAMES: ${total}  (f001..f${pad3(total)})  weight: ${sz}`);
console.log('FLOW anchor indices (0-based):');
console.log(`  stand=0  reach=${reachIdx}  dog=${dogIdx}  lunge=${lungeIdx}  seated=${seatedIdx}`);
console.log(`SET:  A_STAND=0 A_REACH=${reachIdx} A_DOG=${dogIdx} A_LUNGE=${lungeIdx} A_SEATED=${seatedIdx}  FLOW_COUNT=${total}`);
