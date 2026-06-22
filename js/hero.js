/* ============================================================
   SAÏA — 3D Mat Hero controller
   Faithful port of the dim-studio hero: real GLB mat that unrolls
   on scroll, two-keyframe camera lift, progressive hire-offer
   reveal, status/progress, and the booking agent that docks in
   when the mat is fully open.
   Defaults baked from the prototype props: bgColor #FBFAF4,
   matColor #ffffff, easing "slow" (lambda 3).
   ============================================================ */
(function () {
  const THREE = window.THREE;
  const mat = window.SAIA.mat;
  const LAMBDA = 3; // easing: slow

  const wrap = document.getElementById('heroWrap');
  const canvas = document.getElementById('heroCanvas');
  const bar = document.getElementById('heroBar');
  const statusEl = document.getElementById('heroStatus');
  const lead = document.getElementById('heroLead');
  const infoEls = Array.prototype.slice.call(document.getElementById('heroInfo').querySelectorAll('[data-from]'));
  const dock = document.getElementById('agentDock');

  const ctx = {};
  let renderer, scene, camera, group, clock;
  let target = 0, current = 0, agentDocked = false, concierge;

  const camA = { px: 0, py: 3.5, pz: 2.3, tx: 0, ty: 0, tz: 0.35 };
  const camB = { px: 0, py: 4.7, pz: 5.0, tx: 0, ty: 0, tz: 1.5 };

  function updateCamera(p) {
    const e = p * p * (3 - 2 * p); const L = (a, b) => a + (b - a) * e;
    camera.position.set(L(camA.px, camB.px), L(camA.py, camB.py), L(camA.pz, camB.pz));
    camera.lookAt(L(camA.tx, camB.tx), L(camA.ty, camB.ty), L(camA.tz, camB.tz));
  }
  function updateTarget() {
    if (!wrap) return;
    const total = wrap.offsetHeight - window.innerHeight;
    if (total <= 0) { target = 0; return; }
    const scrolled = -wrap.getBoundingClientRect().top;
    target = Math.min(1, Math.max(0, scrolled / total));
  }
  function onResize() {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function reveal(p) {
    for (const e of infoEls) {
      const from = parseFloat(e.getAttribute('data-from')) || 0;
      const k = Math.min(1, Math.max(0, (p - from) / 0.12));
      e.style.opacity = k.toFixed(3); e.style.transform = 'translateY(' + ((1 - k) * 16).toFixed(1) + 'px)';
    }
    if (lead) { const lk = Math.min(1, Math.max(0, (p - 0.02) / 0.14)); lead.style.opacity = (1 - lk).toFixed(3); }
    const open = p > 0.965;
    if (open !== agentDocked) {
      agentDocked = open;
      if (open) { dock.style.display = 'flex'; concierge.greet(); }
      else { dock.style.display = 'none'; }
    }
  }

  function paint() {
    if (!renderer) return;
    mat.deform(ctx, current); updateCamera(current); renderer.render(scene, camera);
    if (bar) bar.style.height = (current * 100).toFixed(1) + '%';
    if (statusEl) { const p = current; statusEl.textContent = p < 0.004 ? 'Rolled' : (p > 0.992 ? 'Open' : Math.round(p * 100) + '% Open'); }
    reveal(current);
  }

  function init(glb) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene(); scene.environment = mat.makeEnv(renderer);
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100); updateCamera(0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6f6a60, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-1.6, 4.8, 2.6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.5; key.shadow.camera.far = 18;
    key.shadow.camera.left = -2.6; key.shadow.camera.right = 2.6; key.shadow.camera.top = 2.6; key.shadow.camera.bottom = -2.6;
    key.shadow.radius = 8; key.shadow.bias = -0.0004; scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff2dc, 1.3); rim.position.set(3.2, 1.6, -2.4); scene.add(rim);

    group = new THREE.Group(); group.rotation.y = Math.PI / 2; group.position.set(0, 0, 0.0); scene.add(group);

    ctx.length = 3.0;
    const geo = mat.buildGeometry(glb, ctx.length);
    ctx.geometry = geo; ctx.basePositions = geo.attributes.position.array.slice(0);
    geo.computeBoundingBox(); ctx.minL = geo.boundingBox.min.x;
    ctx.thickness = Math.max(ctx.length * 0.012, 0.034); ctx.R0 = ctx.thickness * 1.15;

    const normalTex = mat.makeNormalMap();
    const colorMap = glb ? mat.loadColorMap('assets/saia-mat-texture.png') : normalTex;
    const material = new THREE.MeshPhysicalMaterial({
      map: colorMap, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: glb ? 0.9 : 1.0, metalness: 0.0,
      clearcoat: 0.0, envMapIntensity: 0.18, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.32 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.022; ground.receiveShadow = true; scene.add(ground);

    mat.deform(ctx, 0); onResize(); updateTarget();
    renderer.render(scene, camera);
    canvas.style.transition = 'opacity .7s ease'; canvas.style.opacity = '1';

    clock = new THREE.Clock();
    const frame = () => {
      updateTarget();
      const delta = clock.getDelta();
      current = THREE.MathUtils.damp(current, target, LAMBDA, delta);
      if (Math.abs(current - target) < 0.0002) current = target;
      paint();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', updateTarget, { passive: true });
  }

  function wireConcierge() {
    concierge = window.SAIA.createAgenticConcierge({
      threadEl: document.getElementById('thread'),
      inputEl: document.getElementById('conciergeInput'),
      sendBtn: document.getElementById('conciergeSend'),
      chipEls: Array.prototype.slice.call(dock.querySelectorAll('.saia-chip')),
      hireFlashEl: document.getElementById('hirePanel'),
      hireValueEls: {
        mats: document.querySelector('[data-hire="mats"]'),
        date: document.querySelector('[data-hire="date"]'),
        total: document.querySelector('[data-hire="total"]'),
        status: document.querySelector('[data-hire="status"]'),
      },
      greeting: 'Welcome — I am your SAÏA booking agent. Tell me your event (try “30 people on Saturday”) and I will build the hire for you here: mats, delivery and price.',
    });
  }

  wireConcierge();
  mat.loadGlb('assets/saia-mat.glb').then(init).catch((e) => { console.warn('GLB load failed, using procedural fallback', e); init(null); });
})();
