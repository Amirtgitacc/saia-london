/* ============================================================
   SAÏA — Home 3D controller (Phase 1a: the hero)
   The real saia-mat.glb in a LIGHT cream studio, unrolling on
   scroll — replaces the flat-PNG hero. Reuses window.SAIA.mat
   (the same engine that powers the Journey page) but with airy,
   editorial lighting instead of Journey's dark day-arc.

   Scope now: the hero only (#top). Built to extend — paint(p)
   uses a keyframe table so Phase 1b can carry the mat through
   the rest of the page.

   Fallback: on mobile or prefers-reduced-motion it does nothing
   and the flat PNG (#homeMat) stays. Decorative → aria-hidden.
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});
  const THREE = window.THREE;
  const mat = NS.mat;
  const canvas = document.getElementById('homeCanvas');
  const wrap = document.getElementById('top');             // hero scroll region (230vh)
  const flatPng = document.getElementById('homeMat');      // PNG fallback

  if (!canvas || !wrap || !THREE || !mat) return;           // engine missing → leave PNG
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 767px)').matches;
  if (reduce || small) return;                              // keep the flat PNG, skip WebGL

  /* ---- TUNABLE first-pass constants (we iterate on view) ---- */
  const MAT_LENGTH = 4.3;
  const UNROLL_END = 0.7;        // mat is fully flat by this scroll fraction of the hero
  const frames = [               // camera path across the hero scroll (p 0..1 of #top)
    { p: 0.00, px: 0.55, py: 1.95, pz: 3.65, tx: 0.30, ty: 0.18, tz: 1.05 }, // close on the coil
    { p: UNROLL_END, px: 0.62, py: 2.25, pz: 4.30, tx: 0.34, ty: 0.05, tz: 1.85 }, // unrolled, presented
    { p: 1.00, px: 0.50, py: 2.05, pz: 3.95, tx: 0.30, ty: 0.10, tz: 1.40 }, // settle
  ];

  let renderer, scene, camera, group, meshMaterial, floor, key, hemi;
  let ctx = {}, current = 0, target = 0, lastD = null, clock, visible = true;

  function camAt(p) {
    let lo = frames[0], hi = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) { if (p >= frames[i].p && p <= frames[i + 1].p) { lo = frames[i]; hi = frames[i + 1]; break; } }
    const span = (hi.p - lo.p) || 1; let t = (p - lo.p) / span; t = t * t * (3 - 2 * t);
    const L = (a, b) => a + (b - a) * t;
    camera.position.set(L(lo.px, hi.px), L(lo.py, hi.py), L(lo.pz, hi.pz));
    camera.lookAt(L(lo.tx, hi.tx), L(lo.ty, hi.ty), L(lo.tz, hi.tz));
  }
  function deformFor(p) { return Math.min(1, Math.max(0, p / UNROLL_END)); }

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

  function paint(p) {
    const d = deformFor(p);
    if (lastD == null || Math.abs(d - lastD) > 0.0015) { mat.deform(ctx, d); lastD = d; }
    camAt(p);
    renderer.render(scene, camera);
  }

  function init(glb) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
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
    const colorMap = glb ? mat.loadColorMap('assets/saia-mat-texture.png') : normalTex;
    meshMaterial = new THREE.MeshPhysicalMaterial({
      map: colorMap, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.22, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, meshMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);

    /* soft contact shadow on transparent ground → mat "floats" on the page */
    floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

    mat.deform(ctx, 0); lastD = 0; onResize(); updateTarget(); paint(0);
    if (flatPng) flatPng.style.display = 'none';            // 3D is live → drop the PNG
    canvas.style.transition = 'opacity .8s ease'; canvas.style.opacity = '1';

    clock = new THREE.Clock();
    const loop = () => {
      if (visible) {
        updateTarget();
        current = THREE.MathUtils.damp(current, target, 4.5, clock.getDelta());
        if (Math.abs(current - target) < 0.0002) current = target;
        paint(current);
      } else { clock.getDelta(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);

    /* pause rendering when the hero is off-screen (perf) */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 })
        .observe(wrap);
    }
  }

  mat.loadGlb('assets/saia-mat.glb').then(init).catch((e) => {
    console.warn('[home3d] GLB load failed, keeping flat PNG', e);
    if (flatPng) flatPng.style.display = '';               // restore the fallback
  });
})();
