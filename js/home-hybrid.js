/* ============================================================
   SAÏA — Home: HYBRID journey (Sample B)
   The interactive 3D WebGL mat does the roll → unroll (the part we
   perfected), then cross-fades into the real footage for the beats
   3D can't show — feet stepping on, practice, community.
     p 0.00 → 0.30   3D mat: roll → unroll → settle flat
     p 0.26 → 0.36   cross-fade 3D ⇢ film (both showing a flat mat)
     p 0.36 → 1.00   film scrub: flat → feet → practice → community
   Reuses window.SAIA.mat (mat-core) + the JPEG frame sequence.
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});
  const THREE = window.THREE;
  const mat = NS.mat;
  const ASSETS = window.SAIA_ASSETS || {};
  const GLB_URL = ASSETS.matGlb || 'assets/saia-mat.glb';
  const TEX_URL = ASSETS.matTexture || 'assets/saia-mat-texture.png';
  const DIR = ASSETS.filmDir || 'assets/film/';
  const COUNT = ASSETS.filmFrames || 120;

  const root = document.getElementById('homeRoot');
  const wrap = document.getElementById('top');
  const canvas = document.getElementById('homeCanvas');
  const film = document.getElementById('filmCanvas');
  const stage = document.getElementById('stage');
  const rail = document.getElementById('homeBar');
  const hint = document.getElementById('homeHint');

  function goStatic() { if (root) root.classList.add('is-static'); }
  if (!wrap || !canvas || !film || !THREE || !mat) { goStatic(); return; }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 767px)').matches;
  if (reduce || small) { goStatic(); return; }

  const bandEls = stage ? Array.prototype.slice.call(stage.querySelectorAll('[data-band]')) : [];

  /* ---- timeline ---- */
  const UNROLL_END = 0.30;      // 3D mat fully flat by here
  const CROSS_START = 0.26;     // begin handing over to film
  const CROSS_END = 0.36;       // film fully owns the stage
  const FLAT_FRAME = 43;        // 0-based frame where the filmed mat lies flat

  /* ---- film preload ---- */
  const fctx = film.getContext('2d');
  const frames = new Array(COUNT);
  const pad = (n) => String(n).padStart(3, '0');
  for (let i = 0; i < COUNT; i++) { const img = new Image(); img.src = DIR + 'f' + pad(i + 1) + '.jpg'; frames[i] = img; }
  let fcw = 0, fch = 0, lastFrame = -1;
  function frameFor(p) {
    if (p <= CROSS_END) return FLAT_FRAME;
    const t = (p - CROSS_END) / (1 - CROSS_END);
    return Math.max(FLAT_FRAME, Math.min(COUNT - 1, Math.round(FLAT_FRAME + t * (COUNT - 1 - FLAT_FRAME))));
  }
  function drawFilm(idx) {
    const img = frames[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    const s = Math.max(fcw / img.naturalWidth, fch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    fctx.clearRect(0, 0, fcw, fch);
    fctx.drawImage(img, (fcw - w) / 2, (fch - h) / 2, w, h);
  }

  /* ---- 3D scene (compact port of home-journey) ---- */
  let renderer, scene, camera, group, meshMaterial, floor;
  const c3 = {};
  let current = 0, target = 0, lastD = null, clock, lastT = 0, paused = false;
  const MAT_LENGTH = 4.3;

  /* 3D camera arc, parameterised by t3 = p / CROSS_END (0 rolled → 1 flat) */
  const frames3 = [
    { t: 0.00, px: 3.00, py: 2.00, pz: 3.60, tx: -0.80, ty: 0.20, tz: 0.20 },
    { t: 0.55, px: 3.45, py: 2.70, pz: 5.70, tx: -1.15, ty: 0.00, tz: 1.85 },
    { t: 1.00, px: 2.55, py: 4.30, pz: 5.30, tx: -0.95, ty: 0.00, tz: 2.35 },
  ];
  function camAt(t3) {
    let lo = frames3[0], hi = frames3[frames3.length - 1];
    for (let i = 0; i < frames3.length - 1; i++) { if (t3 >= frames3[i].t && t3 <= frames3[i + 1].t) { lo = frames3[i]; hi = frames3[i + 1]; break; } }
    const span = (hi.t - lo.t) || 1; let t = (t3 - lo.t) / span; t = t * t * (3 - 2 * t);
    const L = (a, b) => a + (b - a) * t;
    camera.position.set(L(lo.px, hi.px), L(lo.py, hi.py), L(lo.pz, hi.pz));
    camera.lookAt(L(lo.tx, hi.tx), L(lo.ty, hi.ty), L(lo.tz, hi.tz));
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (renderer) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    fcw = film.clientWidth || window.innerWidth; fch = film.clientHeight || window.innerHeight;
    film.width = Math.round(fcw * dpr); film.height = Math.round(fch * dpr);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0); lastFrame = -1;
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

  function crossfade(p) {
    let fade = (p - CROSS_START) / (CROSS_END - CROSS_START);   // 0 → 1 across the handover
    fade = Math.max(0, Math.min(1, fade));
    canvas.style.opacity = (1 - fade).toFixed(3);
    film.style.opacity = fade.toFixed(3);
    return fade;
  }

  function paint(p) {
    const fade = crossfade(p);
    if (fade < 1) {                                  // 3D still visible → render it
      const d = Math.min(1, Math.max(0, p / UNROLL_END));
      if (lastD == null || Math.abs(d - lastD) > 0.0015) { mat.deform(c3, d); lastD = d; }
      camAt(Math.min(1, p / CROSS_END));
      renderer.render(scene, camera);
    }
    if (fade > 0) {                                  // film visible → draw the matching frame
      const idx = frameFor(p);
      if (idx !== lastFrame) { drawFilm(idx); lastFrame = idx; }
    }
    if (rail) rail.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.style.opacity = (1 - Math.min(1, p / 0.04)).toFixed(3);
    bands(p);
  }

  function updateTarget() {
    const total = wrap.offsetHeight - window.innerHeight;
    const scrolled = -wrap.getBoundingClientRect().top;
    target = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
  }

  function init(glb) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.environment = mat.makeEnv(renderer);
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xEDE6D8, 0.9));
    const key = new THREE.DirectionalLight(0xfff6ec, 2.0); key.position.set(-2.0, 5.0, 3.2); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.5; key.shadow.camera.far = 22;
    key.shadow.camera.left = -3.5; key.shadow.camera.right = 3.5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.radius = 9; key.shadow.bias = -0.0004; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(3.2, 2.0, -2.2); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2.4, 2.2, 5.0); scene.add(fill);

    group = new THREE.Group(); group.rotation.y = Math.PI / 2; scene.add(group);
    c3.length = MAT_LENGTH;
    const geo = mat.buildGeometry(glb, c3.length);
    c3.geometry = geo; c3.basePositions = geo.attributes.position.array.slice(0);
    geo.computeBoundingBox(); c3.minL = geo.boundingBox.min.x;
    c3.thickness = Math.max(c3.length * 0.012, 0.04); c3.R0 = c3.thickness * 1.15;

    const normalTex = mat.makeNormalMap();
    const colorMap = glb ? mat.loadColorMap(TEX_URL) : normalTex;
    meshMaterial = new THREE.MeshPhysicalMaterial({
      map: colorMap, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.22, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, meshMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
    floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

    mat.deform(c3, 0); lastD = 0; resize();
    canvas.style.transition = film.style.transition = 'opacity .5s ease';
    canvas.style.opacity = '1';

    NS._rig = { at(p) { paused = true; paint(p); }, resume() { paused = false; } };

    clock = new THREE.Clock();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
      if (!paused) {
        updateTarget();
        current = THREE.MathUtils.damp(current, target, 4.5, dt);
        if (Math.abs(current - target) < 0.0002) current = target;
        paint(current);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
  }

  mat.loadGlb(GLB_URL).then(init).catch((e) => { console.warn('[home-hybrid] GLB failed → static', e); goStatic(); });
})();
