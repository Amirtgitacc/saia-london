/* ============================================================
   SAÏA — Home: pinned scroll-driven 3D journey
   One sticky mat (real saia-mat.glb) unrolls then STAYS OPEN in
   a LIGHT cream studio while [data-band] chapters reveal across
   the scroll. Ports journey.js's spine + home3d.js's airy light.
   Reuses window.SAIA.mat. Asset URLs come from window.SAIA_ASSETS
   so the page ports cleanly to a Shopify Liquid theme.
   Mobile / prefers-reduced-motion → .is-static fallback (no WebGL).
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});
  const THREE = window.THREE;
  const mat = NS.mat;
  const ASSETS = window.SAIA_ASSETS || {};
  const GLB_URL = ASSETS.matGlb || 'assets/saia-mat.glb';
  const TEX_URL = ASSETS.matTexture || 'assets/saia-mat-texture.png';

  const root = document.getElementById('homeRoot');
  const wrap = document.getElementById('top');
  const canvas = document.getElementById('homeCanvas');
  const stage = document.getElementById('stage');
  const rail = document.getElementById('homeBar');
  const hint = document.getElementById('homeHint');
  const sticky = document.querySelector('.home-sticky');
  const matStageEl = document.getElementById('matStage');
  const flowCanvas = document.getElementById('flowCanvas');
  const flow2d = flowCanvas ? flowCanvas.getContext('2d') : null;

  function goStatic() { if (root) root.classList.add('is-static'); }

  if (!wrap || !canvas || !THREE || !mat) { goStatic(); return; }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 767px)').matches;
  if (reduce || small) { goStatic(); return; }   // keep the flat PNG, skip WebGL

  const bandEls = stage ? Array.prototype.slice.call(stage.querySelectorAll('[data-band]')) : [];

  /* ---- state ---- */
  let renderer, scene, camera, group, meshMaterial, floor, key, hemi;
  const ctx = {};
  let current = 0, target = 0, lastD = null, clock, visible = true, paused = false;

  /* ---- TUNABLES (iterate live on view) ---- */
  const MAT_LENGTH = 4.3;
  const UNROLL_END = 0.22;          // mat flat by this p of #top, then stays open

  /* camera keyframes (flat mat lies toward +Z; group.rotation.y = π/2) */
  const frames = [
    { p: 0.00, px: 3.00, py: 2.00, pz: 3.60, tx: -0.80, ty: 0.20, tz: 0.20 }, // 1 hero — coil on the right
    { p: 0.20, px: 3.45, py: 2.70, pz: 5.70, tx: -1.15, ty: 0.00, tz: 1.85 }, // 2 present the open mat (3/4)
    { p: 0.38, px: 2.60, py: 4.20, pz: 5.40, tx: -1.00, ty: 0.00, tz: 2.30 }, // 3 elevated plan view
    { p: 0.50, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, // morph begins — steep showcase angle
    { p: 0.56, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 }, // eased to C-gentle (figures' angle)
    { p: 0.66, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 }, // hold C-gentle for the pose flow
    { p: 0.80, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 },
    { p: 1.00, px: 2.30, py: 2.15, pz: 9.20, tx: -0.66, ty: 0.12, tz: 2.16 },
  ];
  function camAt(p) {
    let lo = frames[0], hi = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) { if (p >= frames[i].p && p <= frames[i + 1].p) { lo = frames[i]; hi = frames[i + 1]; break; } }
    const span = (hi.p - lo.p) || 1; let t = (p - lo.p) / span; t = t * t * (3 - 2 * t);
    const L = (a, b) => a + (b - a) * t;
    camera.position.set(L(lo.px, hi.px), L(lo.py, hi.py), L(lo.pz, hi.pz));
    camera.lookAt(L(lo.tx, hi.tx), L(lo.ty, hi.ty), L(lo.tz, hi.tz));
  }
  function deformFor(p) { return Math.min(1, Math.max(0, p / UNROLL_END)); } // unchanged
  /* The mat is ONE mesh the whole way. The watercolour MORPH is now DISABLED: the photoreal
     mat simply fades out at the hand-off (handoffFor) and the watercolour flow sequence — which
     already shows a watercolour mat under Cristina — fades in. Morphing the empty mat to
     watercolour first was redundant. (makeMatMaterial/setMorph kept in place, just driven at 0.) */
  function morphFor(p) { return 0; }
  function bloomFor(p) { return 0; }
  /* hand-off: once the mat is watercolour AND eased to C-gentle, the mesh fades out and the
     on-mat figure illustrations take over (they were drawn from this exact mat, so it's invisible).
     canvas opacity = 1 - handoffFor(p): full through the morph, gone by p0.585 as figure-1 fades in. */
  function handoffFor(p) { let t = (p - 0.556) / 0.014; t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  /* mesh mat screen-space bbox at the current camera (viewport px) — used by the debug rig */
  function meshMatRect() {
    group.updateMatrixWorld(true);
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const b = new THREE.Box3().setFromObject(group), mn = b.min, mx = b.max;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const x of [mn.x, mx.x]) for (const y of [mn.y, mx.y]) for (const z of [mn.z, mx.z]) {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * canvas.clientWidth, sy = (-v.y * 0.5 + 0.5) * canvas.clientHeight;
      if (sx < left) left = sx; if (sx > right) right = sx; if (sy < top) top = sy; if (sy > bottom) bottom = sy;
    }
    return { left, right, top, bottom };
  }

  /* ---- SEQUENTIAL HANDOFF (no overlap): the opened mat fades fully OUT in place
     (handoffFor → 1 by p0.570), then after a brief cream-only beat the watercolour flow fades IN
     (videoFadeFor from p0.576). The two mats are never on screen together → no double-mat.
     Scroll-progress then maps to a decoded still frame. ---- */
  const FLOW_FROM = 0.576, FLOW_TO = 1.0;   // frame 0 shows as the flow fades up (after the mat is gone)
  function videoFadeFor(p) { let t = (p - 0.576) / 0.016; t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  /* ---- 5-LEVEL STEPPED SCRUB (seam-free rebuild) ----
     Scroll → frame index as alternating MOVE (Cristina flows to the next pose) and
     HOLD (pose freezes; that level's text reads) zones. fp = normalised progress
     through the flow range [FLOW_FROM, FLOW_TO]; each segment maps [a,b] of fp to
     frame range [f0,f1] — a HOLD is f0==f1. Each MOVE is ONE continuous Seedance
     keyframe-tween clip (no internal seam); the HOLDs sit on the shared boundary
     anchors so there is no scrub across a clip seam. Anchor frame indices below are
     emitted by tools/seam/assemble.mjs — update them + FLOW_COUNT when frames change. */
  const A_STAND = 0, A_REACH = 69, A_DOG = 156, A_LUNGE = 235, A_SEATED = 302;
  /* MOVES dominate the scroll budget (~0.17 fp each) so the pose-to-pose motion plays
     slowly and is clearly visible at any scroll speed; HOLDs are short (~0.07) — just
     long enough to read the level text. #top is lengthened so each MOVE ≈ one screen. */
  const FLOW_STOPS = [
    { a: 0.00, b: 0.07, f0: A_STAND,  f1: A_STAND  }, // entrance fade-up + HOLD · L1 stands tall
    { a: 0.07, b: 0.24, f0: A_STAND,  f1: A_REACH  }, // MOVE → reach up / heart opens   (slow)
    { a: 0.24, b: 0.31, f0: A_REACH,  f1: A_REACH  }, // HOLD · L2 reaches up
    { a: 0.31, b: 0.49, f0: A_REACH,  f1: A_DOG    }, // MOVE → forward fold / downward dog (slow)
    { a: 0.49, b: 0.56, f0: A_DOG,    f1: A_DOG    }, // HOLD · L3 fold → dog
    { a: 0.56, b: 0.73, f0: A_DOG,    f1: A_LUNGE  }, // MOVE → low lunge                 (slow)
    { a: 0.73, b: 0.80, f0: A_LUNGE,  f1: A_LUNGE  }, // HOLD · L4 low lunge
    { a: 0.80, b: 0.95, f0: A_LUNGE,  f1: A_SEATED }, // MOVE → lower to seat → hands to heart (slow)
    { a: 0.95, b: 1.00, f0: A_SEATED, f1: A_SEATED }, // HOLD · L5 seated, hands to heart
  ];
  const FLOW_DIR = ASSETS.flowFrameDir || 'assets/flow-frames/';
  const FLOW_COUNT = ASSETS.flowFrameCount || 303;
  const flowFrames = flowCanvas ? new Array(FLOW_COUNT) : [];
  let flowLast = -1, flowLastF = -1, flowCw = 0, flowCh = 0;
  const padFrame = n => String(n).padStart(3, '0');

  function loadFlowFrame(i) {
    if (!flowFrames || i < 0 || i >= FLOW_COUNT || flowFrames[i]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = FLOW_DIR + 'f' + padFrame(i + 1) + '.webp';   // transparent cutout (figure+mat, no bg)
    flowFrames[i] = img;
  }
  function initFlowFrames() {
    if (!flowCanvas) return;
    for (let i = 0; i <= 24; i++) loadFlowFrame(i);   // eager: entrance + Level-1 hold (P2 — no nearest-frame fallback on first reach)
    const loadAll = () => {
      let i = 1;
      const batch = () => {
        const end = Math.min(FLOW_COUNT, i + 8);
        while (i < end) loadFlowFrame(i++);
        if (i < FLOW_COUNT) setTimeout(batch, 35);
      };
      batch();
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(loadAll, { timeout: 1200 });
    else setTimeout(loadAll, 300);
  }
  function resizeFlowCanvas() {
    if (!flowCanvas || !flow2d) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    flowCw = flowCanvas.clientWidth || 1;
    flowCh = flowCanvas.clientHeight || 1;
    flowCanvas.width = Math.round(flowCw * dpr);
    flowCanvas.height = Math.round(flowCh * dpr);
    flow2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    flowLast = -1; flowLastF = -1;
  }
  function drawFlowFrame(idx) {
    if (!flowCanvas || !flow2d) return false;
    let img = flowFrames[idx];
    if (!img || !img.complete || !img.naturalWidth) {
      for (let d = 1; d < 10; d++) {
        const prev = flowFrames[idx - d], next = flowFrames[idx + d];
        if (prev && prev.complete && prev.naturalWidth) { img = prev; break; }
        if (next && next.complete && next.naturalWidth) { img = next; break; }
      }
      if (!img || !img.complete || !img.naturalWidth) return false;
    }
    const s = Math.min(flowCw / img.naturalWidth, flowCh / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    flow2d.clearRect(0, 0, flowCw, flowCh);
    flow2d.drawImage(img, (flowCw - w) / 2, (flowCh - h) / 2, w, h);   // transparent cutout composites straight onto the page
    return true;
  }
  /* resolve a usable (decoded) frame, walking to a nearby neighbour if idx isn't ready yet */
  function resolveFlowImg(idx) {
    let img = flowFrames[idx];
    if (img && img.complete && img.naturalWidth) return img;
    for (let d = 1; d < 10; d++) {
      const prev = flowFrames[idx - d], next = flowFrames[idx + d];
      if (prev && prev.complete && prev.naturalWidth) return prev;
      if (next && next.complete && next.naturalWidth) return next;
    }
    return null;
  }
  /* P2 — fractional blending: draw floor(frame) then ceil(frame) at opacity=frac so the
     pose-to-pose motion cross-dissolves between the discrete frames instead of stepping. */
  function drawFlowBlended(i0, i1, frac) {
    if (!flowCanvas || !flow2d) return false;
    const a = resolveFlowImg(i0);
    if (!a) return false;
    const b = (i1 !== i0 && frac > 0.001) ? resolveFlowImg(i1) : null;
    const put = (img, alpha) => {
      const s = Math.min(flowCw / img.naturalWidth, flowCh / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      flow2d.globalAlpha = alpha;
      flow2d.drawImage(img, (flowCw - w) / 2, (flowCh - h) / 2, w, h);
    };
    flow2d.clearRect(0, 0, flowCw, flowCh);
    put(a, 1);
    if (b && b !== a) put(b, frac);
    flow2d.globalAlpha = 1;
    return true;
  }
  function flowFrameFor(p) {
    let fp = (p - FLOW_FROM) / (FLOW_TO - FLOW_FROM);
    fp = Math.max(0, Math.min(1, fp));
    for (const s of FLOW_STOPS) {
      if (fp <= s.b || s === FLOW_STOPS[FLOW_STOPS.length - 1]) {
        let t = (fp - s.a) / ((s.b - s.a) || 1); t = Math.max(0, Math.min(1, t));
        t = t * t * (3 - 2 * t);                      // ease each pose-to-pose transition
        const f = s.f0 + (s.f1 - s.f0) * t;           // P2 — float frame (blended downstream), not rounded
        return Math.max(0, Math.min(FLOW_COUNT - 1, f));
      }
    }
    return FLOW_COUNT - 1;
  }
  function warmFlowAround(idx) {
    for (let d = -3; d <= 6; d++) loadFlowFrame(idx + d);
  }
  function scrubFlow(p) {
    if (!flowCanvas) return;
    const fade = videoFadeFor(p);
    flowCanvas.style.opacity = fade.toFixed(3);
    const f = flowFrameFor(p);                          // float frame position
    const i0 = Math.max(0, Math.min(FLOW_COUNT - 1, Math.floor(f)));
    const i1 = Math.min(FLOW_COUNT - 1, i0 + 1);
    const frac = f - i0;
    warmFlowAround(i0);
    // redraw whenever the float frame moves (every RAF during motion) → no integer stepping
    if (Math.abs(f - flowLastF) > 0.0008 && drawFlowBlended(i0, i1, frac)) { flowLastF = f; flowLast = i0; }
  }

  /* ---- mood track: the SAME mat, but the studio's light, exposure and
     background tone shift per chapter so each beat reads as its own scene.
     Aligned to the seven [data-band] ranges. ---- */
  const MOODS = [
    { p: 0.00, bg: '#F4F0E6', sky: '#fdfbff', ground: '#E8E0CF', key: '#f3f1ff', keyI: 1.95, exp: 1.06 }, // hero — cool & airy
    { p: 0.20, bg: '#F8F4EC', sky: '#ffffff', ground: '#F0E8D7', key: '#fffaf2', keyI: 2.18, exp: 1.17 }, // signature — bright showcase
    { p: 0.36, bg: '#F1E8D5', sky: '#fff6e9', ground: '#E6D6BC', key: '#ffeedc', keyI: 2.02, exp: 1.06 }, // how — neutral warm
    { p: 0.51, bg: '#EBDCBF', sky: '#fff0dc', ground: '#DCC7A4', key: '#ffe4bc', keyI: 1.92, exp: 1.00 }, // gathering — warm glow
    { p: 0.65, bg: '#E2CFA8', sky: '#ffe8cc', ground: '#CFB890', key: '#ffd6a0', keyI: 1.80, exp: 0.92 }, // club — intimate gold
    { p: 0.79, bg: '#ECD9C0', sky: '#fff0e0', ground: '#DECBB2', key: '#ffe6cc', keyI: 1.92, exp: 1.02 }, // pilates — soft warm focus
    { p: 1.00, bg: '#F5F1E8', sky: '#ffffff', ground: '#EDE6D8', key: '#fff8ee', keyI: 2.10, exp: 1.18 }, // join — serene & bright
  ];
  const _bg = new THREE.Color(), _sky = new THREE.Color(), _ground = new THREE.Color(), _key = new THREE.Color();
  const _scrim = new THREE.Color(), _WHITE = new THREE.Color('#ffffff');
  const _CREAM = new THREE.Color('#ece8dc');   // the flow frames' baked background — page eases to this
  function buildMoods() { for (const m of MOODS) { m._bg = new THREE.Color(m.bg); m._sky = new THREE.Color(m.sky); m._ground = new THREE.Color(m.ground); m._key = new THREE.Color(m.key); } }
  function applyMood(p) {
    let lo = MOODS[0], hi = MOODS[MOODS.length - 1];
    for (let i = 0; i < MOODS.length - 1; i++) { if (p >= MOODS[i].p && p <= MOODS[i + 1].p) { lo = MOODS[i]; hi = MOODS[i + 1]; break; } }
    const span = (hi.p - lo.p) || 1; let t = (p - lo.p) / span; t = t * t * (3 - 2 * t);
    key.color.copy(_key.copy(lo._key).lerp(hi._key, t)); key.intensity = lo.keyI + (hi.keyI - lo.keyI) * t;
    hemi.color.copy(_sky.copy(lo._sky).lerp(hi._sky, t));
    hemi.groundColor.copy(_ground.copy(lo._ground).lerp(hi._ground, t));
    renderer.toneMappingExposure = lo.exp + (hi.exp - lo.exp) * t;
    _bg.copy(lo._bg).lerp(hi._bg, t);
    // P1 fix: ease the warm room → the flow's baked cream SMOOTHLY across the morph
    // (p0.50 → p0.576), then hold cream for the whole Cristina flow. No hard snap.
    let cr = (p - 0.50) / 0.076; cr = Math.max(0, Math.min(1, cr)); cr = cr * cr * (3 - 2 * cr);
    if (cr > 0) _bg.lerp(_CREAM, cr);
    if (sticky) sticky.style.backgroundColor = '#' + _bg.getHexString();
    // a scrim tone tied to the scene (the bg lifted toward white) so the text
    // halos read as part of the room, not a foreign cream panel
    const h = _scrim.copy(_bg).lerp(_WHITE, 0.62).getHexString();
    if (root) root.style.setProperty('--scrim', parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16));
  }

  /* ---- Cristina figure sequence: she walks in once the mat is open and flows
     through poses. Each frame cross-dissolves with its neighbours (no cuts);
     gross motion (entrance slide, gentle rise) is done here for smoothness. ---- */
  const figEls = Array.prototype.slice.call(document.querySelectorAll('#figureLayer .saia-fig'));
  /* 15 poses cross-dissolve in one continuous flow over the live watercolour MESH mat
     (the single source of truth — there is no PNG floor). Each figure PNG is a mat-free
     cutout of Cristina, registered by tools/figbake.mjs to one canonical contact point,
     so we only crossfade figure OPACITY; her contact lands on the mesh mat via FIG_BOX. */
  const FIG_FROM = 0.580, FIG_TO = 0.960;
  const FIG_LABELS = ['walk in', 'step on', 'stand', 'arms rise', 'reach up', 'heart open',
    'hinge', 'forward fold', 'downward dog', 'low lunge', 'lower to seat', 'seated cross',
    'seated twist', 'seated reach', 'hands to heart'];
  const FIG = FIG_LABELS.map((label, i, a) => ({ label, p: FIG_FROM + (FIG_TO - FIG_FROM) * i / (a.length - 1) }));
  const FIG_W = 0.026;  // dissolve half-window < frame spacing (0.027) → clean 2-way crossfade, no triple-ghost
  /* shared on-screen box for #matStage + every figure: the baked mat lands exactly here */
  const FIG_BOX = { left: '53%', bottom: '28vh', width: '35vw' };
  function applyBox(el) {
    el.style.position = 'absolute'; el.style.left = FIG_BOX.left; el.style.bottom = FIG_BOX.bottom;
    el.style.width = FIG_BOX.width; el.style.height = 'auto';
    el.style.transform = 'translateX(-50%)'; el.style.transformOrigin = 'bottom center';
  }
  const MAT_SHADOW = 'drop-shadow(0 26px 30px rgba(43,38,32,.16))';
  function initFigures() {
    if (matStageEl) { matStageEl.style.display = 'none'; }   // retired: the live mesh is the only mat now
    // retired on the WebGL path: the scroll-scrubbed flow sequence replaces the 15-PNG crossfade.
    // Kept in the DOM (not deleted) so the .is-static mobile poster can still use the first frame.
    const fl = document.getElementById('figureLayer'); if (fl) fl.style.display = 'none';
  }

  function updateTarget() {
    const total = wrap.offsetHeight - window.innerHeight;
    const scrolled = -wrap.getBoundingClientRect().top;
    target = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
  }
  function onResize() {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    resizeFlowCanvas();
  }

  function bands(p) {
    for (const e of bandEls) {
      const parts = (e.getAttribute('data-band') || '0,1').split(',').map(Number);
      const a = parts[0], b = parts[1];
      const f = Math.min(0.04, (b - a) * 0.3);
      const kin = a <= 0.001 ? 1 : Math.min(1, Math.max(0, (p - a) / f));
      const kout = b >= 0.999 ? 1 : Math.min(1, Math.max(0, (b - p) / f));
      let k = Math.min(kin, kout); if (p < a - 0.001 || p > b + 0.001) k = 0;
      e.style.opacity = k.toFixed(3);
      const inner = e.firstElementChild;
      if (inner) inner.style.transform = 'translateY(' + ((1 - k) * 24).toFixed(1) + 'px)';
      e.style.pointerEvents = k > 0.5 ? 'auto' : 'none';
    }
  }

  function paint(p) {
    const d = deformFor(p);
    if (lastD == null || Math.abs(d - lastD) > 0.0015) { mat.deform(ctx, d); lastD = d; }
    camAt(p);
    applyMood(p);
    if (meshMaterial.userData.setMorph) meshMaterial.userData.setMorph(morphFor(p), bloomFor(p));
    renderer.render(scene, camera);
    canvas.style.opacity = (1 - handoffFor(p)).toFixed(3);
    if (rail) rail.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.style.opacity = (1 - Math.min(1, p / 0.04)).toFixed(3);
    bands(p);
    scrubFlow(p);
  }

  function init(glb) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();                       // transparent — composites over the cream page
    scene.environment = mat.makeEnv(renderer);
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

    /* light cream studio (airy, not Journey's moody day-arc) */
    hemi = new THREE.HemisphereLight(0xffffff, 0xEDE6D8, 0.9); scene.add(hemi);
    key = new THREE.DirectionalLight(0xfff6ec, 2.0); key.position.set(-2.0, 5.0, 3.2); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.5; key.shadow.camera.far = 22;
    key.shadow.camera.left = -3.5; key.shadow.camera.right = 3.5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.radius = 9; key.shadow.bias = -0.0004; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(3.2, 2.0, -2.2); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2.4, 2.2, 5.0); scene.add(fill);

    group = new THREE.Group(); group.rotation.y = Math.PI / 2; scene.add(group);

    ctx.length = MAT_LENGTH;
    const geo = mat.buildGeometry(glb, ctx.length);
    ctx.geometry = geo; ctx.basePositions = geo.attributes.position.array.slice(0);
    geo.computeBoundingBox(); ctx.minL = geo.boundingBox.min.x;
    ctx.thickness = Math.max(ctx.length * 0.012, 0.04); ctx.R0 = ctx.thickness * 1.15;

    const normalTex = mat.makeNormalMap();
    const WC_URL = ASSETS.matWatercolour || 'assets/saia-mat-watercolour.png';
    meshMaterial = glb
      ? mat.makeMatMaterial(TEX_URL, WC_URL, normalTex)
      : new THREE.MeshPhysicalMaterial({ map: normalTex, color: new THREE.Color('#ffffff'),
          normalMap: normalTex, normalScale: new THREE.Vector2(0.3, 0.3),
          roughness: 0.9, metalness: 0.0, envMapIntensity: 0.22, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, meshMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);

    /* soft contact shadow on transparent ground → mat "floats" on the page */
    floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

    buildMoods();
    initFigures();
    initFlowFrames();
    mat.deform(ctx, 0); lastD = 0; onResize(); updateTarget(); paint(0);
    canvas.style.transition = 'opacity .8s ease'; canvas.style.opacity = '1';
    setTimeout(function () { canvas.style.transition = 'none'; }, 850); // per-frame handoff fade must be instant, not lagged

    /* ---- debug rig (tuning only; harmless in production, does nothing unless called) ---- */
    NS._rig = {
      pause() { paused = true; }, resume() { paused = false; },
      /* render the mat at deform d from a camera pose, bypassing the scroll loop */
      shot(d, px, py, pz, tx, ty, tz) {
        paused = true; mat.deform(ctx, d); lastD = d;
        camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz);
        renderer.render(scene, camera);
      },
      /* like shot() but also applies the watercolour morph — for design-exploration renders */
      shotMorph(d, morph, px, py, pz, tx, ty, tz) {
        paused = true; mat.deform(ctx, d); lastD = d;
        if (meshMaterial.userData.setMorph) meshMaterial.userData.setMorph(morph, 0);
        camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz);
        renderer.render(scene, camera);
      },
      bbox() { const b = new THREE.Box3().setFromObject(group); return { min: b.min, max: b.max }; },
      peek() { return { current, target, paused, visible, lastD, morph: morphFor(current), bloom: bloomFor(current), cam: camera.position.toArray() }; },
      /* render the EXACT frame a user sees at scroll-progress p, with the page at the top
         (so sticky is trivially satisfied — used for headless screenshots) */
      at(p) {
        paused = true; current = p;
        const d = deformFor(p); mat.deform(ctx, d); lastD = d;
        camAt(p); applyMood(p);
        if (meshMaterial.userData.setMorph) meshMaterial.userData.setMorph(morphFor(p), bloomFor(p));
        renderer.render(scene, camera);
        canvas.style.opacity = (1 - handoffFor(p)).toFixed(3);
        bands(p); scrubFlow(p);
      },
      matRect() { return meshMatRect(); },         // mesh mat's screen-space bbox at current cam
    };

    clock = new THREE.Clock();
    const loop = () => {
      if (!paused && visible) {
        updateTarget();
        current = THREE.MathUtils.damp(current, target, 3.0, clock.getDelta());
        if (Math.abs(current - target) < 0.0002) current = target;
        paint(current);
      } else { clock.getDelta(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(wrap);
    }
  }

  mat.loadGlb(GLB_URL).then(init).catch((e) => {
    console.warn('[home-journey] GLB load failed → static fallback', e);
    goStatic();
  });
})();
