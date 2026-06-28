/* ============================================================
   SAÏA — "A Day on the Mat" journey controller
   Faithful port of the prototype's WebGL spine: real GLB mat
   unroll, continuous multi-phase camera travel, day-arc lighting,
   scroll-band scene reveals, and the breathing SAÏA assistant.
   ============================================================ */
(function () {
  const THREE = window.THREE;
  const mat = window.SAIA.mat;

  const wrap = document.getElementById('top');
  const canvas = document.getElementById('journeyCanvas');
  const stage = document.getElementById('stage');
  const rail = document.getElementById('railFill');
  const hint = document.getElementById('scrollHint');
  const bandEls = Array.prototype.slice.call(stage.querySelectorAll('[data-band]'));

  const ctx = {};            // deform context (geometry, basePositions, length, thickness, R0, minL)
  let renderer, scene, camera, group, meshMaterial, floor, key, hemi;
  let target = 0, current = 0, lastD = null, t0 = performance.now(), clock;

  /* ---------- colour ramp helpers ---------- */
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function seg(p, s) {
    let lo = s[0], hi = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) { if (p >= s[i].p && p <= s[i + 1].p) { lo = s[i]; hi = s[i + 1]; break; } }
    const span = (hi.p - lo.p) || 1; return { lo, hi, t: Math.min(1, Math.max(0, (p - lo.p) / span)) };
  }
  function rampA(p, s, k) { const g = seg(p, s); const A = hex(g.lo[k]), B = hex(g.hi[k]); return [Math.round(A[0] + (B[0] - A[0]) * g.t), Math.round(A[1] + (B[1] - A[1]) * g.t), Math.round(A[2] + (B[2] - A[2]) * g.t)]; }
  function rampN(p, s, k) { const g = seg(p, s); return g.lo[k] + (g.hi[k] - g.lo[k]) * g.t; }

  const dayStops = [
    { p: 0.00, bg: '#1a1611', fl: '#352d24', k: '#ffe0b4', ki: 1.9, hi: 0.34, ex: 1.00 }, // dawn — inhale
    { p: 0.16, bg: '#241f18', fl: '#5a4d3b', k: '#ffe9d0', ki: 2.2, hi: 0.46, ex: 1.06 }, // morning rising
    { p: 0.46, bg: '#bcae90', fl: '#d8c4a0', k: '#fff4e2', ki: 2.3, hi: 0.6,  ex: 1.10 }, // golden midday
    { p: 0.66, bg: '#b89970', fl: '#d4ba90', k: '#ffd9ad', ki: 2.2, hi: 0.54, ex: 1.08 }, // amber turn
    { p: 0.84, bg: '#5e3b2d', fl: '#8f5a42', k: '#ffb487', ki: 2.0, hi: 0.44, ex: 1.02 }, // dusk rose
    { p: 1.00, bg: '#1a1410', fl: '#372518', k: '#e2956f', ki: 1.7, hi: 0.34, ex: 0.96 }, // exhale
  ];
  function arc(p) {
    return {
      bg: rampA(p, dayStops, 'bg'), fl: rampA(p, dayStops, 'fl'), k: rampA(p, dayStops, 'k'),
      ki: rampN(p, dayStops, 'ki'), hi: rampN(p, dayStops, 'hi'), ex: rampN(p, dayStops, 'ex'),
    };
  }

  /* continuous camera journey (worldZ runs the mat length; flat mat lies toward +Z) */
  const frames = [
    { p: 0.00, px: 0.00, py: 2.60, pz: 3.40, tx: 0, ty: 0.20, tz: 0.40 }, // hero: the rolled coil
    { p: 0.16, px: 0.00, py: 1.60, pz: 2.40, tx: 0, ty: 0.00, tz: 2.20 }, // tip onto the mat
    { p: 0.30, px: 0.00, py: 1.05, pz: 0.40, tx: 0, ty: 0.00, tz: 2.90 }, // looking down the mat
    { p: 0.50, px: 0.00, py: 1.05, pz: 2.10, tx: 0, ty: 0.00, tz: 4.60 }, // travelling
    { p: 0.70, px: 0.00, py: 1.15, pz: 3.70, tx: 0, ty: 0.00, tz: 6.10 }, // toward the far end
    { p: 0.86, px: 0.00, py: 1.60, pz: 2.20, tx: 0, ty: 0.05, tz: 1.40 }, // come back as it rolls up
    { p: 1.00, px: 0.00, py: 2.30, pz: 1.60, tx: 0, ty: 0.10, tz: 0.20 }, // settle on the roll
  ];
  function camAt(p) {
    let lo = frames[0], hi = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) { if (p >= frames[i].p && p <= frames[i + 1].p) { lo = frames[i]; hi = frames[i + 1]; break; } }
    const span = (hi.p - lo.p) || 1; let t = (p - lo.p) / span; t = t * t * (3 - 2 * t);
    const L = (a, b) => a + (b - a) * t;
    camera.position.set(L(lo.px, hi.px), L(lo.py, hi.py), L(lo.pz, hi.pz));
    camera.lookAt(L(lo.tx, hi.tx), L(lo.ty, hi.ty), L(lo.tz, hi.tz));
  }

  function deformFor(p) {
    let d;
    if (p < 0.16) d = p / 0.16;
    else if (p < 0.82) d = 1;
    else d = 1 - (p - 0.82) / 0.18;
    return Math.min(1, Math.max(0, d));
  }

  function updateTarget() {
    if (!wrap) return;
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
      const kout = Math.min(1, Math.max(0, (b - p) / f));
      let k = Math.min(kin, kout); if (p < a - 0.001 || p > b + 0.001) k = 0;
      e.style.opacity = k.toFixed(3);
      e.style.transform = (e.getAttribute('data-band').indexOf('0.18') === 0
        ? 'translateY(calc(-50% + ' + ((1 - k) * 22).toFixed(1) + 'px))'
        : 'translateY(' + ((1 - k) * 24).toFixed(1) + 'px)');
      e.style.pointerEvents = k > 0.5 ? 'auto' : 'none';
    }
  }

  function paint(p) {
    if (!renderer) return;
    const t = (performance.now() - t0) / 1000;
    const breath = (Math.sin(t * 2 * Math.PI / 9) + 1) / 2;
    const d = deformFor(p);
    if (lastD == null || Math.abs(d - lastD) > 0.0015) { mat.deform(ctx, d); lastD = d; }
    camAt(p);
    const a = arc(p);
    scene.background.set('rgb(' + a.bg.join(',') + ')');
    floor.material.color.set('rgb(' + a.fl.join(',') + ')');
    key.color.set('rgb(' + a.k.join(',') + ')'); key.intensity = a.ki * (0.96 + breath * 0.08);
    hemi.intensity = a.hi;
    renderer.toneMappingExposure = a.ex;
    renderer.render(scene, camera);
    if (rail) rail.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.style.opacity = (1 - Math.min(1, p / 0.04)).toFixed(3);
    bands(p);
  }

  function init(glb) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene(); scene.background = new THREE.Color('#1b1712'); scene.environment = mat.makeEnv(renderer);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

    hemi = new THREE.HemisphereLight(0xffffff, 0x6f6a60, 0.45); scene.add(hemi);
    key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-1.6, 4.8, 3.2); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.5; key.shadow.camera.far = 24;
    key.shadow.camera.left = -3.5; key.shadow.camera.right = 3.5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.radius = 8; key.shadow.bias = -0.0004; scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff2dc, 1.1); rim.position.set(3.2, 1.8, -2.4); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(2.4, 2.2, 5.0); scene.add(fill);

    group = new THREE.Group(); group.rotation.y = Math.PI / 2; scene.add(group);

    ctx.length = 6.0;
    const geo = mat.buildGeometry(glb, ctx.length);
    ctx.geometry = geo; ctx.basePositions = geo.attributes.position.array.slice(0);
    geo.computeBoundingBox(); ctx.minL = geo.boundingBox.min.x;
    ctx.thickness = Math.max(ctx.length * 0.012, 0.04); ctx.R0 = ctx.thickness * 1.15;

    const normalTex = mat.makeNormalMap();
    const colorMap = glb ? mat.loadColorMap('assets/saia-mat-texture.png') : normalTex;
    meshMaterial = new THREE.MeshPhysicalMaterial({
      map: colorMap, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.18, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, meshMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);

    floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a3228'), roughness: 0.98, metalness: 0.0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

    mat.deform(ctx, 0); lastD = 0; onResize(); updateTarget();
    paint(0);
    canvas.style.transition = 'opacity .8s ease'; canvas.style.opacity = '1';

    clock = new THREE.Clock();
    const frame = () => {
      updateTarget();
      const delta = clock.getDelta();
      current = THREE.MathUtils.damp(current, target, 4.5, delta);
      if (Math.abs(current - target) < 0.0002) current = target;
      paint(current);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    window.addEventListener('resize', onResize);
  }

  /* ---------- SAÏA assistant ---------- */
  function wireConcierge() {
    const closed = document.getElementById('conciergeClosed');
    const panel = document.getElementById('conciergePanel');
    const greeting = "Hello, lovely. I'm the SAÏA assistant — your host for the club. I can plan mat hire for an event, share what's on, book you in for Pilates with Cristina, or help you decide if SAÏA is right for you. Where shall we begin?";

    const concierge = window.SAIA.createAgenticConcierge({
      threadEl: document.getElementById('thread'),
      inputEl: document.getElementById('conciergeInput'),
      sendBtn: document.getElementById('conciergeSend'),
      chipEls: Array.prototype.slice.call(panel.querySelectorAll('.saia-chip')),
      hireFlashEl: document.getElementById('hirePanel'),
      hireValueEls: {
        mats: document.querySelector('[data-hire="mats"]'),
        date: document.querySelector('[data-hire="date"]'),
        total: document.querySelector('[data-hire="total"]'),
        deposit: document.querySelector('[data-hire="deposit"]'),
        status: document.querySelector('[data-hire="status"]'),
      },
      greeting: greeting,
    });

    function open() { closed.style.display = 'none'; panel.style.display = 'flex'; concierge.greet(); }
    function close() { panel.style.display = 'none'; closed.style.display = 'flex'; }

    document.getElementById('conciergeOpen').addEventListener('click', open);
    document.getElementById('conciergeClose').addEventListener('click', close);
    Array.prototype.slice.call(document.querySelectorAll('[data-open-hire]')).forEach((b) =>
      b.addEventListener('click', () => { open(); setTimeout(() => concierge.send("I'd like to hire mats for an event"), 350); })
    );
  }

  /* ---------- boot ---------- */
  wireConcierge();
  mat.loadGlb('assets/saia-mat.glb').then(init).catch((e) => { console.warn('GLB load failed, using procedural fallback', e); init(null); });
})();
