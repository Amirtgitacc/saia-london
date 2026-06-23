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
    { p: 0.50, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, // 4 settle so the 3D mat lands on
    { p: 0.66, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, //   the hero-mat PNG's rect (the
    { p: 0.80, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, //   3D mat is hidden past ~0.56,
    { p: 1.00, px: 2.30, py: 3.78, pz: 8.00, tx: -0.66, ty: 0.12, tz: 2.16 }, //   so these just hold it steady)
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
  /* The mat is ONE mesh the whole way. At the hand-off we MORPH its material from photoreal
     to flat watercolour in place (R1) — the WebGL canvas stays fully visible; there is no
     second PNG mat. morphFor: 0 until p0.50, 1 by p0.56, smoothstepped. */
  function morphFor(p) { let t = (p - 0.50) / 0.06; t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  /* brief paint-bloom pulse at the moment of change (finishes crisp) */
  function bloomFor(p) { const t = (p - 0.50) / 0.06; return (t <= 0 || t >= 1) ? 0 : Math.sin(t * Math.PI); }

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
    figEls.forEach(function (el, i) {
      if (!FIG[i]) return;
      applyBox(el);
      el.style.opacity = '0';
      el.style.willChange = 'opacity';   // mat is baked-in & pre-registered → pure crossfade
    });
  }
  function figures(p) {
    for (let i = 0; i < figEls.length; i++) {
      const f = FIG[i], el = figEls[i]; if (!f) continue;
      let k = 1 - Math.abs(p - f.p) / FIG_W; k = Math.max(0, Math.min(1, k)); k = k * k * (3 - 2 * k);
      el.style.opacity = k.toFixed(3);
    }
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
  }

  function bands(p) {
    for (const e of bandEls) {
      const parts = (e.getAttribute('data-band') || '0,1').split(',').map(Number);
      const a = parts[0], b = parts[1];
      const f = Math.min(0.055, (b - a) * 0.4);
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
    canvas.style.opacity = '1';   // the mesh IS the mat for the whole journey
    if (rail) rail.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.style.opacity = (1 - Math.min(1, p / 0.04)).toFixed(3);
    bands(p);
    figures(p);
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
        canvas.style.opacity = '1';
        bands(p); figures(p);
      },
      matRect() {                                  // mesh mat's screen-space bbox at current cam
        const b = new THREE.Box3().setFromObject(group);
        const pts = [], mn = b.min, mx = b.max;
        for (const x of [mn.x, mx.x]) for (const y of [mn.y, mx.y]) for (const z of [mn.z, mx.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera);
          pts.push([(v.x * 0.5 + 0.5) * canvas.clientWidth, (-v.y * 0.5 + 0.5) * canvas.clientHeight]);
        }
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      },
    };

    clock = new THREE.Clock();
    const loop = () => {
      if (!paused && visible) {
        updateTarget();
        current = THREE.MathUtils.damp(current, target, 4.5, clock.getDelta());
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
